#!/bin/sh
# OL-20261125-053: portable build for the descriptor-relative no-follow Apply helper.
# Usage: sh research/real-apply-helper-build.sh [output-binary]
# Uses $CC (default cc); compiles with the strict CI flags the repo already uses.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
out=${1:-"$here/real-apply-helper"}
: "${CC:=cc}"
"$CC" -std=c11 -Wall -Wextra -Werror -O2 "$here/real-apply-helper.c" -o "$out"
echo "built $out"
