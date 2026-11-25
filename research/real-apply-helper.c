/*
 * OL-20261125-053 — REAL APPLY BOUNDARY PROTOTYPE: descriptor-relative,
 * no-follow, single-file write helper. TEST-ONLY / DISABLED.
 *
 * Write-path companion of research/os-path-inspector.c (read-only prior art).
 * This is a research prototype, NOT an enabled production Apply path: no
 * Runtime/Worker/Weixin caller exists and agent-handoff/REAL_APPLY_GATES.md
 * stays controlling.
 *
 * What this helper DOES (all through openat(2) + fstat(2) + *at(2)):
 *  - the root fd is opened O_NOFOLLOW|O_DIRECTORY; its dev+ino MUST equal the
 *    caller-supplied registered project identity (else nothing is touched);
 *  - every path component is opened via openat() + O_NOFOLLOW: a symlink
 *    component fails ELOOP instead of being traversed, and each intermediate
 *    directory inode stays pinned by an open fd, which holds the original
 *    inode across a same-name path-ABA rename;
 *  - the target is verified through its own fd (regular file, owner uid,
 *    nlink==1, narrow owner-only mode, no special flags/xattrs); the preimage
 *    bytes/size/mode/mtime are read through that fd and re-verified
 *    immediately before the write;
 *  - the staged after-image is created inside the verified parent directory
 *    fd with O_CREAT|O_EXCL|O_NOFOLLOW, fsync'd, installed with
 *    renameat/linkat/unlinkat relative to that SAME parent directory fd;
 *  - the durable journal (status record + before-image capture) is written
 *    fd-relative under the transaction journal directory fd, outside the
 *    source tree, with fsync of file + directory before every transition;
 *  - recover is read-only classification (APPLIED / PREPARED_CRASH /
 *    AMBIGUOUS); it never repairs, never retries, never deletes anything.
 *
 * Honest limits (do NOT over-claim):
 *  - a non-cooperating same-user writer that replaces the target directory
 *    ENTRY (unlink+create of the same name) between the final preimage check
 *    and renameat can still win for 'modify': the rename clobbers it. Writer
 *    quiescence is an external requirement this helper cannot create alone.
 *  - ancestor swap above the pinned root fd, mount changes and ACL/xattr/flag
 *    classes beyond the tiny checks below are NOT defeated.
 *  - process-kill crash injection is not power-loss durability evidence.
 *  - capability authentication lives in the Node driver; this helper only
 *    re-validates the exact values it is handed and never trusts a path.
 *
 * Usage:
 *   real-apply-helper inspect <root> <exp_dev> <exp_ino> <relpath>
 *       exp_dev/exp_ino 0 means "bind what you see and report it".
 *   real-apply-helper apply|rollback|recover  (spec lines on stdin)
 *       spec: one 'key=value' line per key; no duplicates; no unknown keys.
 *
 * Prints only tokens/hashes/ids (never host paths, never file bytes).
 * Exit codes: 0 OK, 2 REJECT (policy), 3 ERROR (OS failure).
 * 'stop_after=<step>' busy-waits after completing that journal step so a test
 * can SIGKILL this exact OS process to inject a crash between steps.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE 1
#endif
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/xattr.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <stdint.h>
#include <time.h>

#ifndef O_CLOEXEC
#define O_CLOEXEC 0
#endif
#ifndef O_NOFOLLOW
#error "O_NOFOLLOW is required; no fallback to unsafe path traversal"
#endif
#ifndef O_DIRECTORY
#error "O_DIRECTORY is required; no fallback to unsafe directory traversal"
#endif
#ifndef AT_SYMLINK_NOFOLLOW
#error "AT_SYMLINK_NOFOLLOW is required"
#endif

#define MAX_PATH_BYTES 500
#define MAX_COMPONENT_BYTES 127
#define MAX_IMAGE_BYTES (16LL * 1024 * 1024)

#if defined(__APPLE__)
#define ST_MTIM st_mtimespec
#else
#define ST_MTIM st_mtim
#endif

/* ---------- output helpers: stable codes, never a path or bytes ---------- */
static int emit_code(const char *stream, const char *code) {
    printf("%s %s\n", stream, code);
    fflush(stdout);
    return 2;
}
#define REJECT(code) emit_code("REJECT", code)

/* ---------- SHA-256 (compact, self-contained; FIPS 180-4) ---------- */
/* FIPS 180-4 round constants: fractional parts of cube roots of first 64 primes. */
static const uint32_t SHA_K[64] = {
    0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u, 0x3956c25bu, 0x59f111f1u,
    0x923f82a4u, 0xab1c5ed5u, 0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u,
    0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u, 0xe49b69c1u, 0xefbe4786u,
    0x0fc19dc6u, 0x240ca1ccu, 0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
    0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u, 0xc6e00bf3u, 0xd5a79147u,
    0x06ca6351u, 0x14292967u, 0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u,
    0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u, 0xa2bfe8a1u, 0xa81a664bu,
    0xc24b8b70u, 0xc76c51a3u, 0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
    0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u, 0x391c0cb3u, 0x4ed8aa4au,
    0x5b9cca4fu, 0x682e6ff3u, 0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u,
    0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u
};

static uint32_t rotr32(uint32_t x, unsigned n) { return (x >> n) | (x << (32 - n)); }
typedef struct {
    uint32_t h[8];
    uint8_t buf[64];
    uint64_t len;
    size_t fill;
} sha256_ctx;

static void sha256_init(sha256_ctx *c) {
    static const uint32_t iv[8] = {
        0x6a09e667u, 0xbb67ae85u, 0x3c6ef372u, 0xa54ff53au,
        0x510e527fu, 0x9b05688cu, 0x1f83d9abu, 0x5be0cd19u
    };
    memcpy(c->h, iv, sizeof iv);
    c->len = 0;
    c->fill = 0;
}
static void sha256_transform(sha256_ctx *c, const uint8_t blk[64]) {
    uint32_t w[64];
    for (int i = 0; i < 16; ++i)
        w[i] = ((uint32_t)blk[i * 4] << 24) | ((uint32_t)blk[i * 4 + 1] << 16) |
               ((uint32_t)blk[i * 4 + 2] << 8) | (uint32_t)blk[i * 4 + 3];
    for (int i = 16; i < 64; ++i) {
        const uint32_t s0 = rotr32(w[i - 15], 7) ^ rotr32(w[i - 15], 18) ^ (w[i - 15] >> 3);
        const uint32_t s1 = rotr32(w[i - 2], 17) ^ rotr32(w[i - 2], 19) ^ (w[i - 2] >> 10);
        w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }
    uint32_t a = c->h[0], b = c->h[1], cc = c->h[2], d = c->h[3];
    uint32_t e = c->h[4], f = c->h[5], g = c->h[6], hh = c->h[7];
    for (int i = 0; i < 64; ++i) {
        const uint32_t S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
        const uint32_t ch = (e & f) ^ ((~e) & g);
        const uint32_t t1 = hh + S1 + ch + SHA_K[i] + w[i];
        const uint32_t S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
        const uint32_t maj = (a & b) ^ (a & cc) ^ (b & cc);
        const uint32_t t2 = S0 + maj;
        hh = g; g = f; f = e; e = d + t1;
        d = cc; cc = b; b = a; a = t1 + t2;
    }
    c->h[0] += a; c->h[1] += b; c->h[2] += cc; c->h[3] += d;
    c->h[4] += e; c->h[5] += f; c->h[6] += g; c->h[7] += hh;
}
static void sha256_update(sha256_ctx *c, const uint8_t *data, size_t n) {
    c->len += n;
    while (n > 0) {
        size_t take = 64 - c->fill;
        if (take > n) take = n;
        memcpy(c->buf + c->fill, data, take);
        c->fill += take;
        data += take;
        n -= take;
        if (c->fill == 64) { sha256_transform(c, c->buf); c->fill = 0; }
    }
}
static void sha256_final(sha256_ctx *c, char hex[65]) {
    uint64_t bits = c->len * 8ULL;
    uint8_t pad = 0x80;
    sha256_update(c, &pad, 1);
    while (c->fill != 56) {
        uint8_t zero = 0;
        sha256_update(c, &zero, 1);
    }
    uint8_t lenb[8];
    for (int i = 0; i < 8; ++i) lenb[i] = (uint8_t)(bits >> (56 - i * 8));
    sha256_update(c, lenb, 8);
    static const char hexd[] = "0123456789abcdef";
    size_t at = 0;
    for (int i = 0; i < 8; ++i)
        for (int j = 0; j < 4; ++j) {
            const uint8_t byte = (uint8_t)(c->h[i] >> (24 - j * 8));
            hex[at++] = hexd[byte >> 4];
            hex[at++] = hexd[byte & 0x0f];
        }
    hex[at] = '\0';
}
/* ---------- policy predicates ---------- */
static int safe_component(const char *part, size_t length) {
    if (length == 0 || length > MAX_COMPONENT_BYTES || part[0] == '.') return 0;
    for (size_t j = 0; j < length; ++j) {
        const unsigned char ch = (unsigned char)part[j];
        if (!((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') ||
              (ch >= '0' && ch <= '9') || ch == '_' || ch == '-' || ch == '.'))
            return 0;
    }
    return 1;
}
static int safe_relative_path(const char *path) {
    const size_t length = strnlen(path, MAX_PATH_BYTES + 1);
    if (length == 0 || length > MAX_PATH_BYTES || path[0] == '/') return 0;
    const char *cursor = path;
    while (*cursor) {
        const char *slash = strchr(cursor, '/');
        const size_t n = slash ? (size_t)(slash - cursor) : strlen(cursor);
        if (!safe_component(cursor, n)) return 0;
        if (!slash) break;
        cursor = slash + 1;
    }
    return 1;
}
static int private_dir(const struct stat *st) {
    return S_ISDIR(st->st_mode) && st->st_uid == geteuid() && (st->st_mode & 022) == 0;
}
static int narrow_mode(mode_t mode) {
    /* Ordinary file; the same narrow range as the proposal contract (real-apply-contract.ts):
     * 0o400..0o755, no group/world WRITE (0o022), no setuid/setgid/sticky (0o7000). */
    if (!S_ISREG(mode) || (mode & 07000) != 0) return 0;
    const mode_t perms = mode & 0777;
    return perms >= 0400 && perms <= 0755 && (perms & 0022) == 0;
}
static int no_special_flags(const struct stat *st) {
#ifdef __APPLE__
    return st->st_flags == 0;
#else
    (void)st;
    return 1;
#endif
}
/* Exactly one com.apple.provenance NAME allowed on Darwin (system stamp);
 * every other observable attribute refused; Linux refuses any nonempty list. */
static int no_extended_attributes(int fd) {
#ifdef __APPLE__
    const ssize_t needed = flistxattr(fd, NULL, 0, 0);
#else
    const ssize_t needed = flistxattr(fd, NULL, 0);
#endif
    if (needed < 0 || needed > 8192) return 0;
    if (needed == 0) return 1;
#ifndef __APPLE__
    /* Linux has no macOS provenance exception. */
    return 0;
#else
    char names[8192];
    const ssize_t actual = flistxattr(fd, names, (size_t)needed, 0);
    if (actual != needed) return 0;
    size_t at = 0;
    int provenance = 0;
    while (at < (size_t)actual) {
        const size_t remaining = (size_t)actual - at;
        const char *end = memchr(names + at, '\0', remaining);
        if (!end) return 0;
        const size_t n = (size_t)(end - (names + at));
        if (n != strlen("com.apple.provenance") ||
            memcmp(names + at, "com.apple.provenance", n) != 0 ||
            ++provenance != 1) return 0;
        at += n + 1;
    }
    return at == (size_t)actual;
#endif
}

/* ---------- fsync helpers ---------- */
static int fsync_fd(int fd) {
#ifdef _POSIX_SYNCHRONIZED_IO
    if (fdatasync(fd) == 0) return 0;
#endif
    return fsync(fd) == 0 ? 0 : -1;
}
static int sync_dir_fd(int fd) { return fsync(fd) == 0 ? 0 : -1; }

/* ---------- identity accessors ---------- */
static long long st_dev(const struct stat *st) { return (long long)st->st_dev; }
static long long st_ino(const struct stat *st) { return (long long)st->st_ino; }

/* Hash bytes reachable through an already-open fd; a final fstat guards
 * against a size change observed during the read (TOCTOU inside the read). */
static int hash_fd(int fd, long long *count, char hex[65], const char **why) {
    sha256_ctx c;
    sha256_init(&c);
    uint8_t chunk[65536];
    long long total = 0;
    *count = 0;
    for (;;) {
        const ssize_t n = read(fd, chunk, sizeof chunk);
        if (n == 0) break;
        if (n < 0) {
            *why = (errno == EINTR) ? "read-interrupted" : "read-failure";
            return -1;
        }
        total += n;
        if (total > MAX_IMAGE_BYTES) { *why = "target-too-large"; return -1; }
        sha256_update(&c, chunk, (size_t)n);
    }
    struct stat after;
    if (fstat(fd, &after) != 0) { *why = "fstat-failure"; return -1; }
    if ((long long)after.st_size != total) { *why = "target-changed-during-read"; return -1; }
    sha256_final(&c, hex);
    *count = total;
    return 0;
}

/* ---------- root fd bound to the registered project identity ---------- */
/* macOS reports ENOTDIR (Linux ELOOP) for O_DIRECTORY|O_NOFOLLOW on a symlink;
 * confirm the entry with lstatat so both platforms produce root-is-symlink. */
static int open_root_bound(const char *root, long long exp_dev, long long exp_ino, const char **why) {
    const int fd = open(root, O_RDONLY | O_CLOEXEC | O_NOFOLLOW | O_DIRECTORY);
    if (fd < 0) {
        if (errno == ELOOP) { *why = "root-is-symlink"; return -1; }
        if (errno == ENOTDIR) {
            struct stat probe;
            if (lstat(root, &probe) == 0 && S_ISLNK(probe.st_mode)) { *why = "root-is-symlink"; return -1; }
        }
        *why = "root-open-failure"; return -1;
    }
    struct stat st;
    if (fstat(fd, &st) != 0) { close(fd); *why = "root-fstat-failure"; return -1; }
    if (!private_dir(&st) || !no_special_flags(&st)) { close(fd); *why = "root-unsafe"; return -1; }
    if (exp_dev != 0 && (st_dev(&st) != exp_dev || st_ino(&st) != exp_ino)) {
        close(fd); *why = "root-identity-drift"; return -1;
    }
    return fd;
}

/* Walk every component with openat + O_NOFOLLOW. The caller keeps ownership
 * of `root`; this function closes only its own intermediate fds.
 * Returns 0 with *parent_out pinned and *target_out open (verified regular),
 * 1 with *parent_out pinned and *target_out == -1 when the leaf does not exist
 * yet (legal for 'add'), -1 on failure with *why a stable rejection code.
 * On failure the caller must close(root) itself. */
static int walk_to(const int root, const char *path, int *parent_out, int *target_out, const char **why) {
    int current = root; /* owned by caller until the first step replaces it */
    *parent_out = -1;
    *target_out = -1;
    const char *cursor = path;
    for (;;) {
        const char *slash = strchr(cursor, '/');
        const size_t n = slash ? (size_t)(slash - cursor) : strlen(cursor);
        char segment[MAX_COMPONENT_BYTES + 1];
        if (n == 0 || n > MAX_COMPONENT_BYTES) { *why = "path-unsafe"; return -1; }
        memcpy(segment, cursor, n);
        segment[n] = '\0';
        const int last = slash == NULL;
        /* O_NONBLOCK prevents hanging on a FIFO before fstat; the final opened
         * object must nevertheless be a regular file, never device/socket/FIFO. */
        int flags = O_RDONLY | O_NONBLOCK | O_CLOEXEC | O_NOFOLLOW;
        if (!last) flags |= O_DIRECTORY;
        const int fd = openat(current, segment, flags);
        if (fd < 0) {
            if (errno == ELOOP) { *why = "symlink-component"; return -1; }
            if (errno == ENOTDIR) {
                /* macOS: O_DIRECTORY|O_NOFOLLOW on a symlink gives ENOTDIR (Linux: ELOOP).
                 * Inspect the entry itself to tell a symlink from a non-directory. */
                struct stat probe;
                if (fstatat(current, segment, &probe, AT_SYMLINK_NOFOLLOW) == 0 && S_ISLNK(probe.st_mode)) {
                    *why = "symlink-component"; return -1;
                }
                *why = "component-not-directory"; return -1;
            }
            if (errno == ENOENT && last) {
                *parent_out = current; /* pinned parent (caller owns it) */
                *why = "target-missing";
                return 1;
            }
            if (last) {
                /* The leaf exists but cannot be opened as a regular file (e.g. a
                 * unix socket gives ENXIO). Classify the entry itself instead of
                 * reporting a generic open failure. */
                struct stat entry;
                if (fstatat(current, segment, &entry, AT_SYMLINK_NOFOLLOW) == 0) {
                    if (S_ISLNK(entry.st_mode)) { *why = "symlink-component"; return -1; }
                    if (!S_ISREG(entry.st_mode)) { *why = "target-not-regular"; return -1; }
                }
            }
            *why = (errno == ENOENT) ? "component-missing" : "component-open-failure";
            return -1;
        }
        struct stat st;
        if (fstat(fd, &st) != 0) {
            close(fd);
            *why = "component-fstat-failure";
            return -1;
        }
        if (!last) {
            if (!private_dir(&st) || !no_special_flags(&st)) {
                close(fd);
                *why = "component-unsafe-directory";
                return -1;
            }
            if (current != root) close(current);
            current = fd;
            cursor = slash + 1;
            continue;
        }
        /* final component */
        if (!S_ISREG(st.st_mode)) { close(fd); *why = "target-not-regular"; return -1; }
        if (st.st_uid != geteuid()) { close(fd); *why = "target-not-owner"; return -1; }
        if (st.st_nlink != 1) { close(fd); *why = "target-hardlinked"; return -1; }
        if (!narrow_mode(st.st_mode)) { close(fd); *why = "target-unsafe-mode"; return -1; }
        if (!no_special_flags(&st)) { close(fd); *why = "target-flags"; return -1; }
        if (!no_extended_attributes(fd)) { close(fd); *why = "target-xattr"; return -1; }
        *parent_out = current;
        *target_out = fd;
        return 0;
    }
}

/* Open just the parent directory fd of a relative path (target may not exist). */
static int open_parent(const int root, const char *path, int *parent_out, const char **why) {
    *parent_out = -1;
    const char *cursor = path;
    int current = root;
    for (;;) {
        const char *slash = strchr(cursor, '/');
        if (slash == NULL) { *parent_out = current; return 0; }
        const size_t n = (size_t)(slash - cursor);
        char segment[MAX_COMPONENT_BYTES + 1];
        if (n == 0 || n > MAX_COMPONENT_BYTES) { *why = "path-unsafe"; return -1; }
        memcpy(segment, cursor, n);
        segment[n] = '\0';
        const int fd = openat(current, segment, O_RDONLY | O_NONBLOCK | O_CLOEXEC | O_NOFOLLOW | O_DIRECTORY);
        if (fd < 0) {
            *why = (errno == ELOOP) ? "symlink-component" : "component-open-failure";
            if (current != root) close(current);
            return -1;
        }
        struct stat st;
        if (fstat(fd, &st) != 0 || !private_dir(&st) || !no_special_flags(&st)) {
            close(fd);
            if (current != root) close(current);
            *why = "component-unsafe-directory";
            return -1;
        }
        if (current != root) close(current);
        current = fd;
        cursor = slash + 1;
    }
}

static const char *basename_of(const char *path) {
    const char *slash = strrchr(path, '/');
    return slash ? slash + 1 : path;
}

/* ---------- durable journal (fd-relative, fsync'd, never a source path) ---------- */
static int journal_write(int jdir, const char *name, const char *body, const char **why) {
    char tmp[160];
    if (snprintf(tmp, sizeof tmp, ".state-%s-%d", name, (int)getpid()) >= (int)sizeof tmp) {
        *why = "journal-name-too-long";
        return -1;
    }
    const int fd = openat(jdir, tmp, O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC | O_NOFOLLOW, 0600);
    if (fd < 0) { *why = "journal-create-failure"; return -1; }
    size_t left = strlen(body);
    const char *cursor = body;
    while (left > 0) {
        const ssize_t n = write(fd, cursor, left);
        if (n <= 0) {
            close(fd);
            unlinkat(jdir, tmp, 0);
            *why = (errno == EINTR) ? "journal-write-interrupted" : "journal-write-failure";
            return -1;
        }
        cursor += n;
        left -= (size_t)n;
    }
    if (fsync_fd(fd) != 0) {
        close(fd);
        unlinkat(jdir, tmp, 0);
        *why = "journal-fsync-failure";
        return -1;
    }
    close(fd);
    if (renameat(jdir, tmp, jdir, name) != 0) {
        unlinkat(jdir, tmp, 0);
        *why = "journal-rename-failure";
        return -1;
    }
    if (sync_dir_fd(jdir) != 0) { *why = "journal-dir-fsync-failure"; return -1; }
    return 0;
}

/* Copy the bytes currently reachable through `src_fd` into the journal as the
 * durable before-image (streamed through the SAME fd the preimage was
 * verified through), then fsync file + journal directory. */
static int journal_capture_before(int jdir, const char *name, int src_fd, long long *count, char hex[65], const char **why) {
    const int fd = openat(jdir, name, O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC | O_NOFOLLOW, 0600);
    if (fd < 0) { *why = "backup-create-failure"; return -1; }
    if (lseek(src_fd, 0, SEEK_SET) != 0) { close(fd); *why = "backup-rewind-failure"; return -1; }
    uint8_t chunk[65536];
    sha256_ctx c;
    sha256_init(&c);
    long long total = 0;
    for (;;) {
        const ssize_t n = read(src_fd, chunk, sizeof chunk);
        if (n == 0) break;
        if (n < 0) { close(fd); *why = "backup-read-failure"; return -1; }
        total += n;
        if (total > MAX_IMAGE_BYTES) { close(fd); *why = "backup-too-large"; return -1; }
        sha256_update(&c, chunk, (size_t)n);
        const ssize_t w = write(fd, chunk, (size_t)n);
        if (w != n) { close(fd); *why = "backup-write-failure"; return -1; }
    }
    if (fsync_fd(fd) != 0) { close(fd); *why = "backup-fsync-failure"; return -1; }
    close(fd);
    if (sync_dir_fd(jdir) != 0) { *why = "backup-dir-fsync-failure"; return -1; }
    *count = total;
    sha256_final(&c, hex);
    return 0;
}

/* Open the transaction journal directory (owner-only, not a symlink). */
static int open_tx_dir(const char *path, const char **why) {
    const int fd = open(path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW | O_DIRECTORY);
    if (fd < 0) { *why = "tx-dir-open-failure"; return -1; }
    struct stat st;
    if (fstat(fd, &st) != 0) { close(fd); *why = "tx-dir-fstat-failure"; return -1; }
    if (!private_dir(&st) || !no_special_flags(&st)) { close(fd); *why = "tx-dir-unsafe"; return -1; }
    return fd;
}

/* ---------- spec reader (stdin key=value lines) ---------- */
enum {
    SP_KIND, SP_ROOT, SP_PATH, SP_ACTION, SP_EXP_DEV, SP_EXP_INO,
    SP_BEFORE_SHA, SP_BEFORE_BYTES, SP_BEFORE_MODE, SP_BEFORE_MTIME_SEC, SP_BEFORE_MTIME_NSEC,
    SP_AFTER_SHA, SP_AFTER_BYTES, SP_AFTER_MODE, SP_AFTER_IMAGE,
    SP_TX_DIR, SP_TRANSACTION, SP_NONCE, SP_CAP, SP_PLAN_DIGEST, SP_STOP_AFTER, SP_COUNT
};
static const char *SP_NAMES[SP_COUNT] = {
    "kind", "root", "path", "action", "exp_dev", "exp_ino",
    "before_sha256", "before_bytes", "before_mode", "before_mtime_sec", "before_mtime_nsec",
    "after_sha256", "after_bytes", "after_mode", "after_image",
    "tx_dir", "transaction_id", "nonce", "capability_id", "plan_digest", "stop_after"
};
static const char *SP_VALUES[SP_COUNT];

static int spec_read(void) {
    for (int i = 0; i < SP_COUNT; ++i) SP_VALUES[i] = NULL;
    char line[512];
    for (;;) {
        if (fgets(line, sizeof line, stdin) == NULL) break;
        size_t n = strlen(line);
        while (n > 0 && (line[n - 1] == '\n' || line[n - 1] == '\r')) line[--n] = '\0';
        if (n == 0) continue;
        char *eq = memchr(line, '=', n);
        if (!eq) return -1;
        *eq = '\0';
        int slot = -1;
        for (int i = 0; i < SP_COUNT; ++i)
            if (strcmp(line, SP_NAMES[i]) == 0) { slot = i; break; }
        /* unknown key or duplicate key = invalid spec (fail closed) */
        if (slot < 0 || SP_VALUES[slot] != NULL) return -1;
        SP_VALUES[slot] = strdup(eq + 1);
        if (SP_VALUES[slot] == NULL) return -1;
    }
    for (int i = 0; i < SP_COUNT; ++i) {
        const int required = i != SP_AFTER_IMAGE && i != SP_STOP_AFTER;
        if (required && SP_VALUES[i] == NULL) return -1;
    }
    return 0;
}

static int parse_ll(const char *text, long long *out) {
    if (text == NULL) return -1;
    errno = 0;
    char *end = NULL;
    const long long v = strtoll(text, &end, 10);
    if (errno != 0 || end == NULL || *end != '\0' || end == text) return -1;
    *out = v;
    return 0;
}
static int digest_token(const char *text) {
    if (text == NULL) return 0;
    if (strcmp(text, "-") == 0) return 1;
    if (strlen(text) != 64) return 0;
    for (size_t i = 0; i < 64; ++i) {
        const char c = text[i];
        if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return 0;
    }
    return 1;
}
static int nonce_safe(const char *text) {
    if (text == NULL) return 0;
    const size_t n = strlen(text);
    if (n == 0 || n > 64) return 0;
    for (size_t i = 0; i < n; ++i) {
        const char c = text[i];
        if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return 0;
    }
    return 1;
}
static int id_safe(const char *text) {
    if (text == NULL) return 0;
    const size_t n = strlen(text);
    if (n == 0 || n > 80) return 0;
    for (size_t i = 0; i < n; ++i) {
        const char c = text[i];
        const int ok = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ||
                       c == '-' || c == '_' || (i > 0 && c == '.');
        if (!ok) return 0;
    }
    if (text[0] == '.') return 0;
    return 1;
}

/* ---------- crash-injection stop point (busy-wait; killed by the test) ---------- */
static void stop_here(const char *step) {
    const char *want = SP_VALUES[SP_STOP_AFTER];
    if (want == NULL || strcmp(want, step) != 0) return;
    printf("STEP %s\n", step);
    fflush(stdout);
    for (;;) {
        struct timespec nap = {1, 0};
        nanosleep(&nap, NULL);
    }
}

/* ---------- journal status record ---------- */
static int write_record(int jdir, const char *status, const struct stat *target,
                        long long tdev, long long tino, const char **why) {
    char body[2048];
    long long size = 0, mode = 0, mtime_sec = 0, mtime_nsec = 0;
    if (target != NULL) {
        size = (long long)target->st_size;
        mode = (long long)target->st_mode & 07777;
        mtime_sec = (long long)target->ST_MTIM.tv_sec;
        mtime_nsec = (long long)target->ST_MTIM.tv_nsec;
    }
    const int n = snprintf(body, sizeof body,
        "version=1\ntransaction_id=%s\ncapability_id=%s\nnonce=%s\nkind=%s\npath=%s\naction=%s\n"
        "plan_digest=%s\nroot_dev=%s\nroot_ino=%s\nbefore_sha256=%s\nafter_sha256=%s\n"
        "target_dev=%lld\ntarget_ino=%lld\ntarget_size=%lld\ntarget_mode=%lld\n"
        "target_mtime_sec=%lld\ntarget_mtime_nsec=%lld\nstatus=%s\n",
        SP_VALUES[SP_TRANSACTION], SP_VALUES[SP_CAP], SP_VALUES[SP_NONCE], SP_VALUES[SP_KIND],
        SP_VALUES[SP_PATH], SP_VALUES[SP_ACTION], SP_VALUES[SP_PLAN_DIGEST],
        SP_VALUES[SP_EXP_DEV], SP_VALUES[SP_EXP_INO],
        SP_VALUES[SP_BEFORE_SHA], SP_VALUES[SP_AFTER_SHA],
        tdev, tino, size, mode, mtime_sec, mtime_nsec, status);
    if (n < 0 || n >= (int)sizeof body) { *why = "journal-record-too-long"; return -1; }
    return journal_write(jdir, "journal.rec", body, why);
}

/* ---------- preimage verification through the target fd ---------- */
/* Re-stats through the fd itself; never trusts a stat captured earlier. */
static int verify_preimage(int target_fd, struct stat *fresh, const char **why) {
    if (strcmp(SP_VALUES[SP_BEFORE_SHA], "-") == 0) return 0; /* add: nothing to match */
    struct stat st;
    if (fstat(target_fd, &st) != 0) { *why = "preimage-fstat-failure"; return -1; }
    if (fresh != NULL) *fresh = st;
    long long count = 0;
    char hex[65];
    if (hash_fd(target_fd, &count, hex, why) != 0) return -1;
    if (strcmp(hex, SP_VALUES[SP_BEFORE_SHA]) != 0) { *why = "preimage-hash-drift"; return -1; }
    long long expected = 0;
    if (parse_ll(SP_VALUES[SP_BEFORE_BYTES], &expected) != 0 || count != expected) {
        *why = "preimage-size-drift"; return -1;
    }
    long long want_mode = 0;
    if (parse_ll(SP_VALUES[SP_BEFORE_MODE], &want_mode) != 0 ||
        (long long)(st.st_mode & 07777) != want_mode) { *why = "preimage-mode-drift"; return -1; }
    long long want_sec = 0, want_nsec = 0;
    if (parse_ll(SP_VALUES[SP_BEFORE_MTIME_SEC], &want_sec) != 0 ||
        parse_ll(SP_VALUES[SP_BEFORE_MTIME_NSEC], &want_nsec) != 0 ||
        (long long)st.ST_MTIM.tv_sec != want_sec || (long long)st.ST_MTIM.tv_nsec != want_nsec) {
        *why = "preimage-mtime-drift"; return -1;
    }
    return 0;
}

/* ---------- the write ---------- */
static int do_write(const char *subcommand) {
    const char *why = NULL;
    const char *kind = SP_VALUES[SP_KIND];
    const int is_rollback = strcmp(subcommand, "rollback") == 0;
    if (strcmp(kind, is_rollback ? "rollback" : "apply") != 0) return REJECT("capability-kind-mismatch");
    const char *action = SP_VALUES[SP_ACTION];
    const int is_add = strcmp(action, "add") == 0;
    const int is_modify = strcmp(action, "modify") == 0;
    const int is_delete = strcmp(action, "delete") == 0;
    if (!is_add && !is_modify && !is_delete) return REJECT("action-unknown");
    if (!digest_token(SP_VALUES[SP_BEFORE_SHA]) || !digest_token(SP_VALUES[SP_AFTER_SHA]))
        return REJECT("image-digest-unparseable");
    if (!nonce_safe(SP_VALUES[SP_NONCE]) || !id_safe(SP_VALUES[SP_TRANSACTION]) ||
        !id_safe(SP_VALUES[SP_CAP]) || !digest_token(SP_VALUES[SP_PLAN_DIGEST]))
        return REJECT("spec-identifier-unparseable");
    const int has_before = strcmp(SP_VALUES[SP_BEFORE_SHA], "-") != 0;
    const int has_after = strcmp(SP_VALUES[SP_AFTER_SHA], "-") != 0;
    if (is_add && (has_before || !has_after)) return REJECT("action-image-mismatch");
    if (is_delete && (!has_before || has_after)) return REJECT("action-image-mismatch");
    if (is_modify && (!has_before || !has_after)) return REJECT("action-image-mismatch");
    if (has_after && SP_VALUES[SP_AFTER_IMAGE] == NULL) return REJECT("after-image-name-missing");
    if (has_after && !id_safe(SP_VALUES[SP_AFTER_IMAGE])) return REJECT("after-image-name-unsafe");

    long long exp_dev = 0, exp_ino = 0;
    if (parse_ll(SP_VALUES[SP_EXP_DEV], &exp_dev) != 0 || parse_ll(SP_VALUES[SP_EXP_INO], &exp_ino) != 0)
        return REJECT("expected-identity-unparseable");
    if (!safe_relative_path(SP_VALUES[SP_PATH])) return REJECT("path-unsafe");

    const int root = open_root_bound(SP_VALUES[SP_ROOT], exp_dev, exp_ino, &why);
    if (root < 0) return REJECT(why);

    int parent = -1, target = -1;
    const int walked = walk_to(root, SP_VALUES[SP_PATH], &parent, &target, &why);
    if (walked == 1) { /* leaf missing */
        if (!is_add) {
            if (parent >= 0) close(parent);
            close(root);
            return REJECT("target-missing"); /* external delete happened; never guess */
        }
        /* 'add' is legal on a missing leaf: the pinned parent from walk_to is
         * already correct (walk_to pinned it). */
    } else if (walked != 0) {
        if (parent >= 0) close(parent);
        if (target >= 0) close(target);
        close(root);
        return REJECT(why);
    } else if (is_add) {
        close(parent); close(target); close(root);
        return REJECT("target-exists-for-add"); /* add must never clobber */
    }

    struct stat st;
    if (target >= 0 && fstat(target, &st) != 0) {
        close(parent); close(target); close(root);
        return REJECT("target-fstat-failure");
    }
    const long long tdev = target >= 0 ? st_dev(&st) : 0;
    const long long tino = target >= 0 ? st_ino(&st) : 0;

    /* 1) verify the preimage through the target fd before anything is written */
    if (target >= 0 && verify_preimage(target, &st, &why) != 0) {
        close(parent); close(target); close(root);
        return REJECT(why);
    }

    const int jdir = open_tx_dir(SP_VALUES[SP_TX_DIR], &why);
    if (jdir < 0) {
        close(parent); if (target >= 0) { close(target); }
        close(root);
        return REJECT(why);
    }

    /* 2) durable before-image + 'prepared' record (fsync'd, fd-relative) */
    if (has_before) {
        long long count = 0;
        char hex[65];
        if (journal_capture_before(jdir, "before.bin", target, &count, hex, &why) != 0) {
            close(jdir); close(parent); close(target); close(root);
            return REJECT(why);
        }
        if (strcmp(hex, SP_VALUES[SP_BEFORE_SHA]) != 0 || count != (long long)st.st_size) {
            close(jdir); close(parent); close(target); close(root);
            return REJECT("backup-digest-drift");
        }
    }
    if (write_record(jdir, "prepared", target >= 0 ? &st : NULL, tdev, tino, &why) != 0) {
        close(jdir); close(parent); if (target >= 0) { close(target); }
        close(root);
        return REJECT(why);
    }
    stop_here("prepared");

    /* 3) stage the after-image inside the pinned parent directory fd */
    const char *leaf = basename_of(SP_VALUES[SP_PATH]);
    char stage_name[160];
    if (snprintf(stage_name, sizeof stage_name, ".dsh-apply-%s.tmp", SP_VALUES[SP_NONCE]) >= (int)sizeof stage_name) {
        close(jdir); close(parent); if (target >= 0) { close(target); }
        close(root);
        return REJECT("stage-name-too-long");
    }
    if (has_after) {
        const int src = openat(jdir, SP_VALUES[SP_AFTER_IMAGE], O_RDONLY | O_NONBLOCK | O_CLOEXEC | O_NOFOLLOW);
        if (src < 0) {
            close(jdir); close(parent); if (target >= 0) { close(target); }
            close(root);
            return REJECT("after-image-open-failure");
        }
        struct stat sst;
        if (fstat(src, &sst) != 0 || !S_ISREG(sst.st_mode) ||
            sst.st_uid != geteuid() || sst.st_nlink != 1) {
            close(src); close(jdir); close(parent); if (target >= 0) { close(target); }
            close(root);
            return REJECT("after-image-unsafe");
        }
        const int stage = openat(parent, stage_name, O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC | O_NOFOLLOW, 0600);
        if (stage < 0) {
            close(src); close(jdir); close(parent); if (target >= 0) { close(target); }
            close(root);
            return REJECT("stage-create-failure");
        }
        uint8_t chunk[65536];
        sha256_ctx c;
        sha256_init(&c);
        long long total = 0;
        for (;;) {
            const ssize_t n = read(src, chunk, sizeof chunk);
            if (n == 0) break;
            if (n < 0) {
                close(stage); close(src); close(jdir); close(parent);
                if (target >= 0) { close(target); }
                close(root);
                unlinkat(parent, stage_name, 0);
                return REJECT("after-image-read-failure");
            }
            total += n;
            if (total > MAX_IMAGE_BYTES) {
                close(stage); close(src); close(jdir); close(parent);
                if (target >= 0) { close(target); }
                close(root);
                unlinkat(parent, stage_name, 0);
                return REJECT("after-image-too-large");
            }
            sha256_update(&c, chunk, (size_t)n);
            const ssize_t w = write(stage, chunk, (size_t)n);
            if (w != n) {
                close(stage); close(src); close(jdir); close(parent);
                if (target >= 0) { close(target); }
                close(root);
                unlinkat(parent, stage_name, 0);
                return REJECT("stage-write-failure");
            }
        }
        char hex[65];
        sha256_final(&c, hex);
        if (strcmp(hex, SP_VALUES[SP_AFTER_SHA]) != 0) {
            close(stage); close(src); close(jdir); close(parent);
            if (target >= 0) { close(target); }
            close(root);
            unlinkat(parent, stage_name, 0);
            return REJECT("after-image-drift");
        }
        long long want_bytes = 0;
        if (parse_ll(SP_VALUES[SP_AFTER_BYTES], &want_bytes) != 0 || total != want_bytes) {
            close(stage); close(src); close(jdir); close(parent);
            if (target >= 0) { close(target); }
            close(root);
            unlinkat(parent, stage_name, 0);
            return REJECT("after-image-size-drift");
        }
        long long want_mode = 0;
        if (parse_ll(SP_VALUES[SP_AFTER_MODE], &want_mode) != 0 ||
            want_mode < 0400 || want_mode > 0755 ||
            (want_mode & 0022) != 0 || (want_mode & 07000) != 0) {
            close(stage); close(src); close(jdir); close(parent);
            if (target >= 0) { close(target); }
            close(root);
            unlinkat(parent, stage_name, 0);
            return REJECT("after-mode-unsafe");
        }
        if (fchmod(stage, (mode_t)want_mode) != 0) {
            close(stage); close(src); close(jdir); close(parent);
            if (target >= 0) { close(target); }
            close(root);
            unlinkat(parent, stage_name, 0);
            return REJECT("stage-chmod-failure");
        }
        if (fsync_fd(stage) != 0) {
            close(stage); close(src); close(jdir); close(parent);
            if (target >= 0) { close(target); }
            close(root);
            unlinkat(parent, stage_name, 0);
            return REJECT("stage-fsync-failure");
        }
        close(stage);
        close(src);
        if (sync_dir_fd(parent) != 0) {
            close(jdir); close(parent); if (target >= 0) { close(target); }
            close(root);
            return REJECT("stage-dir-fsync-failure");
        }
    }
    if (write_record(jdir, "staged", target >= 0 ? &st : NULL, tdev, tino, &why) != 0) {
        close(jdir); close(parent); if (target >= 0) { close(target); }
        close(root);
        return REJECT(why);
    }
    stop_here("staged");

    /* 4) re-verify the preimage through the SAME target fd immediately before
     *    the write, and prove the leaf entry still points at that exact inode */
    if (target >= 0) {
        if (lseek(target, 0, SEEK_SET) != 0) {
            close(jdir); close(parent); close(target); close(root);
            return REJECT("target-rewind-failure");
        }
        if (verify_preimage(target, &st, &why) != 0) {
            close(jdir); close(parent); close(target); close(root);
            if (has_after) unlinkat(parent, stage_name, 0);
            return REJECT(why);
        }
        struct stat entry;
        if (fstatat(parent, leaf, &entry, AT_SYMLINK_NOFOLLOW) != 0) {
            close(jdir); close(parent); close(target); close(root);
            if (has_after) unlinkat(parent, stage_name, 0);
            return REJECT("target-entry-drift");
        }
        if (st_ino(&entry) != tino || st_dev(&entry) != tdev) {
            close(jdir); close(parent); close(target); close(root);
            if (has_after) unlinkat(parent, stage_name, 0);
            return REJECT("target-entry-identity-drift");
        }
    }
    if (write_record(jdir, "applying", target >= 0 ? &st : NULL, tdev, tino, &why) != 0) {
        close(jdir); close(parent); if (target >= 0) { close(target); }
        close(root);
        return REJECT(why);
    }
    stop_here("applying");

    /* 5) the write itself, relative to the pinned parent directory fd */
    if (is_add) {
        if (linkat(parent, stage_name, parent, leaf, 0) != 0) {
            const int code = errno;
            close(jdir); close(parent); close(root);
            unlinkat(parent, stage_name, 0);
            return REJECT(code == EEXIST ? "target-appeared-during-write" : "linkat-failure");
        }
        if (unlinkat(parent, stage_name, 0) != 0) {
            close(jdir); close(parent); close(root);
            return REJECT("stage-unlink-failure");
        }
    } else if (is_modify) {
        if (renameat(parent, stage_name, parent, leaf) != 0) {
            close(jdir); close(parent); if (target >= 0) { close(target); }
            close(root);
            unlinkat(parent, stage_name, 0);
            return REJECT("renameat-failure");
        }
    } else {
        if (unlinkat(parent, leaf, 0) != 0) {
            close(jdir); close(parent); if (target >= 0) { close(target); }
            close(root);
            return REJECT("unlinkat-failure");
        }
    }
    if (sync_dir_fd(parent) != 0) {
        close(jdir); close(parent); if (target >= 0) { close(target); }
        close(root);
        return REJECT("write-dir-fsync-failure");
    }
    if (target >= 0) { close(target); target = -1; }
    stop_here("written");

    /* 6) post-verification through a freshly opened target fd in the same parent fd */
    if (has_after) {
        const int fd = openat(parent, leaf, O_RDONLY | O_NONBLOCK | O_CLOEXEC | O_NOFOLLOW);
        if (fd < 0) { close(jdir); close(parent); close(root); return REJECT("post-open-failure"); }
        struct stat post;
        if (fstat(fd, &post) != 0) {
            close(fd); close(jdir); close(parent); close(root);
            return REJECT("post-fstat-failure");
        }
        if (!S_ISREG(post.st_mode) || post.st_uid != geteuid() || post.st_nlink != 1 ||
            !narrow_mode(post.st_mode) || !no_special_flags(&post) || !no_extended_attributes(fd)) {
            close(fd); close(jdir); close(parent); close(root);
            return REJECT("post-unsafe-target");
        }
        long long want_mode = 0;
        if (parse_ll(SP_VALUES[SP_AFTER_MODE], &want_mode) != 0 ||
            (long long)(post.st_mode & 07777) != want_mode) {
            close(fd); close(jdir); close(parent); close(root);
            return REJECT("post-mode-drift");
        }
        long long count = 0;
        char hex[65];
        if (hash_fd(fd, &count, hex, &why) != 0) {
            close(fd); close(jdir); close(parent); close(root);
            return REJECT(why);
        }
        close(fd);
        if (strcmp(hex, SP_VALUES[SP_AFTER_SHA]) != 0) {
            close(jdir); close(parent); close(root);
            return REJECT("post-hash-drift");
        }
        long long want_bytes = 0;
        if (parse_ll(SP_VALUES[SP_AFTER_BYTES], &want_bytes) != 0 || count != want_bytes) {
            close(jdir); close(parent); close(root);
            return REJECT("post-size-drift");
        }
        if (write_record(jdir, "applied", &post, st_dev(&post), st_ino(&post), &why) != 0) {
            close(jdir); close(parent); close(root);
            return REJECT(why);
        }
        printf("OK APPLIED %lld %lld %s %lld %lld\n",
               st_dev(&post), st_ino(&post), hex, count, (long long)(post.st_mode & 07777));
        fflush(stdout);
        close(jdir); close(parent); close(root);
        return 0;
    }
    /* delete: the name must be gone (the external writer must not have re-created it) */
    struct stat ghost;
    if (fstatat(parent, leaf, &ghost, AT_SYMLINK_NOFOLLOW) == 0) {
        close(jdir); close(parent); close(root);
        return REJECT("post-entry-reappeared");
    }
    if (write_record(jdir, "applied", NULL, 0, 0, &why) != 0) {
        close(jdir); close(parent); close(root);
        return REJECT(why);
    }
    printf("OK APPLIED %s %s %s %lld %lld\n",
           SP_VALUES[SP_EXP_DEV], SP_VALUES[SP_EXP_INO], "-", 0LL, 0LL);
    fflush(stdout);
    close(jdir); close(parent); close(root);
    return 0;
}

/* ---------- read-only recovery classification (never repairs) ---------- */
static int do_recover(void) {
    const char *why = NULL;
    long long exp_dev = 0, exp_ino = 0;
    if (parse_ll(SP_VALUES[SP_EXP_DEV], &exp_dev) != 0 || parse_ll(SP_VALUES[SP_EXP_INO], &exp_ino) != 0)
        return REJECT("expected-identity-unparseable");
    if (!safe_relative_path(SP_VALUES[SP_PATH])) return REJECT("path-unsafe");
    const int root = open_root_bound(SP_VALUES[SP_ROOT], exp_dev, exp_ino, &why);
    if (root < 0) return REJECT(why);

    int parent = -1, target = -1;
    const int walked = walk_to(root, SP_VALUES[SP_PATH], &parent, &target, &why);
    char stage_name[160];
    snprintf(stage_name, sizeof stage_name, ".dsh-apply-%s.tmp", SP_VALUES[SP_NONCE]);

    const int is_add = strcmp(SP_VALUES[SP_ACTION], "add") == 0;
    const int is_delete = strcmp(SP_VALUES[SP_ACTION], "delete") == 0;

    if (walked == 1) { /* target missing */
        int p2 = parent >= 0 ? parent : -1;
        if (p2 < 0) {
            if (open_parent(root, SP_VALUES[SP_PATH], &p2, &why) != 0) { close(root); return REJECT(why); }
        }
        struct stat staged_st;
        const int staged = fstatat(p2, stage_name, &staged_st, AT_SYMLINK_NOFOLLOW) == 0;
        if (p2 >= 0 && p2 != parent) close(p2);
        if (parent >= 0) close(parent);
        close(root);
        const char *cls = is_delete ? "APPLIED" : "PREPARED_CRASH";
        printf("OK CLASSIFY %s %s %s %lld %lld\n", cls,
               staged ? "staged=present" : "staged=absent", "-", 0LL, 0LL);
        fflush(stdout);
        return 0;
    }
    if (walked != 0) {
        if (parent >= 0) close(parent);
        if (target >= 0) close(target);
        close(root);
        /* unsafe or unknown target: never guess, never repair */
        printf("OK CLASSIFY AMBIGUOUS reason=%s %s %lld %lld\n", why, "-", 0LL, 0LL);
        fflush(stdout);
        return 0;
    }

    struct stat st;
    if (fstat(target, &st) != 0) {
        close(parent); close(target); close(root);
        printf("OK CLASSIFY AMBIGUOUS reason=target-fstat-failure %s %lld %lld\n", "-", 0LL, 0LL);
        fflush(stdout);
        return 0;
    }
    long long count = 0;
    char hex[65];
    if (hash_fd(target, &count, hex, &why) != 0) {
        close(parent); close(target); close(root);
        printf("OK CLASSIFY AMBIGUOUS reason=%s %s %lld %lld\n", why, "-", 0LL, 0LL);
        fflush(stdout);
        return 0;
    }
    const char *after = SP_VALUES[SP_AFTER_SHA];
    const char *before = SP_VALUES[SP_BEFORE_SHA];
    int matches_after = 0, matches_before = 0;
    if (!is_delete && strcmp(after, "-") != 0) {
        long long want_bytes = 0, want_mode = 0;
        matches_after = strcmp(hex, after) == 0 &&
            parse_ll(SP_VALUES[SP_AFTER_BYTES], &want_bytes) == 0 && count == want_bytes &&
            parse_ll(SP_VALUES[SP_AFTER_MODE], &want_mode) == 0 &&
            (long long)(st.st_mode & 07777) == want_mode;
    }
    if (!is_add && strcmp(before, "-") != 0) {
        long long want_bytes = 0, want_mode = 0;
        matches_before = strcmp(hex, before) == 0 &&
            parse_ll(SP_VALUES[SP_BEFORE_BYTES], &want_bytes) == 0 && count == want_bytes &&
            parse_ll(SP_VALUES[SP_BEFORE_MODE], &want_mode) == 0 &&
            (long long)(st.st_mode & 07777) == want_mode;
    }
    struct stat staged_st;
    const int staged = fstatat(parent, stage_name, &staged_st, AT_SYMLINK_NOFOLLOW) == 0;
    const char *cls = matches_after ? "APPLIED" : (matches_before ? "PREPARED_CRASH" : "AMBIGUOUS");
    printf("OK CLASSIFY %s %s %lld %lld %s %lld %lld\n", cls,
           staged ? "staged=present" : "staged=absent",
           st_dev(&st), st_ino(&st), hex, count, (long long)(st.st_mode & 07777));
    fflush(stdout);
    close(parent); close(target); close(root);
    return 0;
}

/* ---------- read-only inspect (argv form; preimage capture at issuance) ---------- */
static int do_inspect(int argc, char **argv) {
    if (argc != 6) return REJECT("usage");
    long long exp_dev = 0, exp_ino = 0;
    if (parse_ll(argv[3], &exp_dev) != 0 || parse_ll(argv[4], &exp_ino) != 0)
        return REJECT("expected-identity-unparseable");
    if (!safe_relative_path(argv[5])) return REJECT("path-unsafe");
    const char *why = NULL;
    const int root = open_root_bound(argv[2], exp_dev, exp_ino, &why);
    if (root < 0) return REJECT(why);
    struct stat root_st;
    if (fstat(root, &root_st) != 0) { close(root); return REJECT("root-fstat-failure"); }
    int parent = -1, target = -1;
    const int walked = walk_to(root, argv[5], &parent, &target, &why);
    if (walked == 1) {
        if (parent >= 0) close(parent);
        close(root);
        printf("OK MISSING\n");
        fflush(stdout);
        return 0;
    }
    if (walked != 0) {
        if (parent >= 0) close(parent);
        if (target >= 0) close(target);
        close(root);
        return REJECT(why);
    }
    struct stat st;
    if (fstat(target, &st) != 0) {
        close(parent); close(target); close(root);
        return REJECT("target-fstat-failure");
    }
    long long count = 0;
    char hex[65];
    if (hash_fd(target, &count, hex, &why) != 0) {
        close(parent); close(target); close(root);
        return REJECT(why);
    }
    printf("OK TARGET %lld %lld %lld %lld %s %lld %lld %lld %lld %lld\n",
           st_dev(&root_st), st_ino(&root_st), st_dev(&st), st_ino(&st), hex, count,
           (long long)(st.st_mode & 07777), (long long)st.ST_MTIM.tv_sec,
           (long long)st.ST_MTIM.tv_nsec, (long long)st.st_nlink);
    fflush(stdout);
    close(parent); close(target); close(root);
    return 0;
}

int main(int argc, char **argv) {
    if (argc < 2) return REJECT("usage");
    const char *sub = argv[1];
    if (strcmp(sub, "inspect") == 0) return do_inspect(argc, argv);
    if (spec_read() != 0) return REJECT("spec-invalid");
    if (strcmp(sub, "apply") == 0 || strcmp(sub, "rollback") == 0) return do_write(sub);
    if (strcmp(sub, "recover") == 0) return do_recover();
    return REJECT("subcommand-unknown");
}
