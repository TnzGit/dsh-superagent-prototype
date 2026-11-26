/*
 * TEST FIXTURE ONLY: deliberately remove an unknown xattr from a file in the OS
 * temp-root test harness. NEVER linked into production, never used on user
 * projects; inspect caller-owned fixture path only. Exists because the Linux CI
 * runner does not guarantee the `setfattr` tool; the compiled fixture is the
 * portable cleanup path paired with os-xattr-fixture.c.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE 1
#endif
#include <sys/types.h>
#include <sys/xattr.h>
#include <stdio.h>
int main(int argc, char **argv) {
    if (argc != 2) return 2;
    const char *name =
#ifdef __APPLE__
        "com.example.dsh-inspector-synthetic";
#else
        "user.dsh-inspector-synthetic";
#endif
#ifdef __APPLE__
    int result = removexattr(argv[1], name, 0);
#else
    int result = removexattr(argv[1], name);
#endif
    return result == 0 ? 0 : 3;
}
