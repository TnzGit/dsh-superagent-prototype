/*
 * EXPERIMENTAL / READ-ONLY / TEST-ONLY
 *
 * Native fd-rooted path inspector for disposable synthetic fixture roots.
 * Implements NO source writing, Apply, authorization, filesystem mutation,
 * journal, rollback or production Runtime binding.
 *
 * This is NOT a safe production Apply helper. In particular:
 * - it cannot prevent other OS processes from writing or replacing a tree;
 * - it does not establish operator project identity or exclusive writer domain;
 * - it does not prove ACLs are absent or preserve metadata;
 * - openat(2) alone cannot promise protection from all mount/rename races.
 *
 * Usage (only on synthetic temp fixture):
 *   os-path-inspector <new-private-fixture-root> <ASCII-relative-path>
 *
 * Prints OK or REJECT without printing any host path, file metadata or bytes.
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
#include <string.h>
#include <errno.h>
#include <ctype.h>

#ifndef O_CLOEXEC
#define O_CLOEXEC 0
#endif
#ifndef O_NOFOLLOW
#error "O_NOFOLLOW is required; no fallback to unsafe path traversal"
#endif
#ifndef O_DIRECTORY
#error "O_DIRECTORY is required; no fallback to unsafe directory traversal"
#endif
#define MAX_PATH_BYTES 500
#define MAX_COMPONENT_BYTES 127

static int rejected(void) { puts("REJECT"); return 2; }

static int safe_component(const char *part, size_t length) {
    if (length == 0 || length > MAX_COMPONENT_BYTES || part[0] == '.') return 0;
    for (size_t j = 0; j < length; ++j) {
        unsigned char ch = (unsigned char)part[j];
        if (!((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') ||
              (ch >= '0' && ch <= '9') || ch == '_' || ch == '-' || ch == '.'))
            return 0;
    }
    return 1;
}

static int private_dir(const struct stat *st) {
    return S_ISDIR(st->st_mode) && st->st_uid == geteuid() &&
           (st->st_mode & 022) == 0;
}
static int plain_file(const struct stat *st) {
    return S_ISREG(st->st_mode) && st->st_uid == geteuid() &&
           st->st_nlink == 1 && (st->st_mode & 022) == 0;
}
/*
 * This is ONLY a research/read-only compatibility check, NOT OS authorization.
 * macOS 26 may stamp every newly-created ordinary file with the system-managed
 * com.apple.provenance attribute. Permit exactly that attribute NAME on Darwin;
 * refuse every other xattr (including ACL-like/user-provided attributes).
 *
 * Do not equate a recognized name with trusted contents, and do not claim
 * ACLs/flags, external writers or same-user tampering are secured by this check.
 * A bounded second read rejects races/list changes and malformed name lists.
 */
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
        size_t remaining = (size_t)actual - at;
        const char *end = memchr(names + at, '\0', remaining);
        if (!end) return 0;
        size_t n = (size_t)(end - (names + at));
        if (n != strlen("com.apple.provenance") ||
            memcmp(names + at, "com.apple.provenance", n) != 0 ||
            ++provenance != 1) return 0;
        at += n + 1;
    }
    return at == (size_t)actual;
#endif
}
static int no_special_flags(const struct stat *st) {
#ifdef __APPLE__
    return st->st_flags == 0;
#else
    (void)st;
    return 1;
#endif
}

int main(int argc, char **argv) {
    if (argc != 3) return rejected();
    const char *path = argv[2];
    size_t length = strnlen(path, MAX_PATH_BYTES + 1);
    if (!length || length > MAX_PATH_BYTES || path[0] == '/') return rejected();

    /* Validate the complete relative path before any file is opened. */
    const char *cursor = path;
    while (*cursor) {
        const char *slash = strchr(cursor, '/');
        size_t n = slash ? (size_t)(slash - cursor) : strlen(cursor);
        if (!safe_component(cursor, n)) return rejected();
        if (!slash) break;
        cursor = slash + 1;
    }
    int root = open(argv[1], O_RDONLY | O_CLOEXEC | O_NOFOLLOW | O_DIRECTORY);
    if (root < 0) return rejected();
    struct stat identity;
    if (fstat(root, &identity) != 0 || !private_dir(&identity) || !no_special_flags(&identity)) {
        close(root);
        return rejected();
    }

    int current = root;
    cursor = path;
    int ok = 0;
    for (;;) {
        const char *slash = strchr(cursor, '/');
        const size_t n = slash ? (size_t)(slash - cursor) : strlen(cursor);
        char segment[MAX_COMPONENT_BYTES + 1];
        if (n == 0 || n > MAX_COMPONENT_BYTES) break;
        memcpy(segment, cursor, n);
        segment[n] = '\0';
        const int last = slash == NULL;
        /*
         * O_NONBLOCK prevents hanging on a FIFO before fstat; the final opened
         * object must nevertheless be a regular file, never a device/socket.
         */
        int flags = O_RDONLY | O_NONBLOCK | O_CLOEXEC | O_NOFOLLOW;
        if (!last) flags |= O_DIRECTORY;
        int fd = openat(current, segment, flags);
        if (fd < 0) break;
        struct stat st;
        const int inspected = fstat(fd, &st) == 0 &&
            (last ? (plain_file(&st) && no_special_flags(&st) && no_extended_attributes(fd))
                  : (private_dir(&st) && no_special_flags(&st)));
        if (!inspected) { close(fd); break; }
        if (last) { close(fd); ok = 1; break; }
        if (current != root) close(current);
        current = fd;
        cursor = slash + 1;
    }
    if (current != root) close(current);
    close(root);
    puts(ok ? "OK" : "REJECT");
    return ok ? 0 : 2;
}
