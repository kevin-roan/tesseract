#!/usr/bin/env bash
# Stand-in for `claude -p --output-format stream-json --verbose ...` with the
# prompt on stdin. The prompt selects the scenario: "slow…" waits to be
# cancelled, "fail…" exits without a result, "leak…" leaves a background
# process running after its result.
set -u

if [[ "${1:-}" == "--version" ]]; then
  echo "9.9.9 (Claude Code)"
  exit 0
fi

prompt="$(cat)"
session="sess-fake-123"
args="$*"
args="${args//\"/}"

emit() { printf '%s\n' "$1"; }

emit '{"type":"system","subtype":"init","session_id":"'"$session"'","cwd":"'"$PWD"'","model":"claude-test","tools":["Bash"]}'
emit '{"type":"assistant","message":{"content":[{"type":"text","text":"args: '"${args:0:200}"'"}]},"session_id":"'"$session"'"}'

case "$prompt" in
  slow*)
    emit '{"type":"assistant","message":{"content":[{"type":"text","text":"working slowly"}]},"session_id":"'"$session"'"}'
    sleep 60 &
    wait
    exit 0
    ;;
  fail*)
    echo "boom: simulated failure" >&2
    exit 3
    ;;
  leak*)
    sleep 300 &
    emit '{"type":"assistant","message":{"content":[{"type":"text","text":"leftover='"$!"'"}]},"session_id":"'"$session"'"}'
    emit '{"type":"result","subtype":"success","is_error":false,"duration_ms":10,"num_turns":1,"result":"Started a server","total_cost_usd":0.001,"session_id":"'"$session"'"}'
    exit 0
    ;;
esac

emit '{"type":"assistant","message":{"content":[{"type":"text","text":"prompt length '"${#prompt}"'"}]},"session_id":"'"$session"'"}'
emit '{"type":"assistant","message":{"content":[{"type":"thinking","thinking":"hidden"},{"type":"tool_use","id":"toolu_1","name":"Bash","input":{"command":"ls -la","description":"List files"}}]},"session_id":"'"$session"'"}'
emit '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_1","content":[{"type":"text","text":"file-a\nfile-b"}],"is_error":false}]},"session_id":"'"$session"'"}'
emit 'not json output from a hook'
printf '%s' '{"type":"assistant","message":{"content":[{"type":"text","text":"split '
sleep 0.2
printf '%s\n' 'line"}]},"session_id":"'"$session"'"}'
emit '{"type":"result","subtype":"success","is_error":false,"duration_ms":1234,"num_turns":2,"result":"All done","total_cost_usd":0.0123,"session_id":"'"$session"'"}'
