#!/usr/bin/env bash
# Stand-in for `nice -n <n> <cmd…>` and `ionice -c3 <cmd…>` (installed under either name):
# appends "<name> <args…>" to priority.log next to itself, then runs the command.
set -eu

name="$(basename "$0")"
echo "$name $*" >> "$(dirname "$0")/priority.log"
if [[ "$name" == "nice" ]]; then shift 2; else shift 1; fi
exec "$@"
