#!/usr/bin/env bash
# Stand-in for `claude -p` in issue runs. Markers in the prompt pick the
# scenario: "[slow]" waits to be cancelled, "[fail]" exits without a result,
# "[silent]" finishes with an empty result.
set -u

if [[ "${1:-}" == "--version" ]]; then
  echo "9.9.9 (Claude Code)"
  exit 0
fi

prompt="$(cat)"
session="sess-issue-1"
args="$*"
args="${args//\"/}"

emit() { printf '%s\n' "$1"; }
say() { emit '{"type":"assistant","message":{"content":[{"type":"text","text":"'"$1"'"}]},"session_id":"'"$session"'"}'; }

emit '{"type":"system","subtype":"init","session_id":"'"$session"'","cwd":"'"$PWD"'","model":"claude-test","tools":["Bash"]}'
say "args: ${args:0:200}"
say "issue: ${TESSERACT_ISSUE_ID:-none}"
say "cwd: $PWD"

case "$prompt" in
  *"[slow]"*)
    sleep 60 &
    wait
    exit 0
    ;;
  *"[fail]"*)
    echo "boom: issue failure" >&2
    exit 3
    ;;
  *"[silent]"*) result="" ;;
  *) result="Fixed it" ;;
esac

emit '{"type":"result","subtype":"success","is_error":false,"duration_ms":10,"num_turns":1,"result":"'"$result"'","usage":{"input_tokens":1,"output_tokens":2},"session_id":"'"$session"'"}'
