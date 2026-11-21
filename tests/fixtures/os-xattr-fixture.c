/*
 * TEST FIXTURE ONLY: deliberately add an unknown xattr to a file in the OS
 * temp-root test harness. NEVER linked into production, never used on user
 * projects; inspect caller-owned fixture path only.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE 1
#endif
#include <sys/types.h>
#include <sys/xattr.h>
#include <string.h>
#include <stdio.h>
int main(int argc, char **argv) {
    if (argc != 2) return 2;
    const char *name =
#ifdef __APPLE__
        "com.example.dsh-inspector-synthetic";
#else
        "user.dsh-inspector-synthetic";
#endif
    const char *value = "synthetic-only";
#ifdef __APPLE__
    int result = setxattr(argv[1], name, value, strlen(value), 0, 0);
#else
    int result = setxattr(argv[1], name, value, strlen(value), 0);
#endif
    return result == 0 ? 0 : 3;
}
