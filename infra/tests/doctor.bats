#!/usr/bin/env bats
# tesseract-doctor with every probe stubbed; the VNC check talks to a fake RFB server on
# 127.0.0.1.

load lib/common

DOCTOR="${ROOTFS_BIN}/tesseract-doctor"

setup() {
  unset_tesseract_env
  unset JAVA_HOME ANDROID_HOME WINEPREFIX
  setup_stubs
  export HOME="${BATS_TEST_TMPDIR}/home" TESSERACT_WORKSPACE="${BATS_TEST_TMPDIR}/workspace"
  mkdir -p "${HOME}/.wine" "${TESSERACT_WORKSPACE}"
  touch "${HOME}/.wine/system.reg"
  mkdir -p "${HOME}/.claude"
  echo '{"claudeAiOauth":{"subscriptionType":"max"}}' > "${HOME}/.claude/.credentials.json"

  stub xdpyinfo 'echo "  dimensions:    1600x900 pixels (423x238 millimeters)"'
  stub xprop 'echo "_NET_SUPPORTING_WM_CHECK(WINDOW): window id # 0x400001"'
  stub curl 'echo "{\"status\":\"ok\",\"version\":\"1.2.3\"}"'
  stub supervisorctl 'printf "%s\n" "controller  RUNNING   pid 10, uptime 0:01:00" "openbox     RUNNING   pid 11, uptime 0:01:00" "wine-init   EXITED    Sep 23 03:00 PM" "xvnc        RUNNING   pid 9, uptime 0:01:00"'
  stub wine 'echo wine-10.0'
  stub node 'echo v24.1.0'
  stub bun 'echo 1.4.2'
  stub claude 'echo "2.1.0 (Claude Code)"'
  stub df 'printf "Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/x 1 1 %s 1%% /\n" "${STUB_DF_KB:-52428800}"'

  start_rfb_server "RFB 003.008"
}

teardown() {
  if [[ -n "${RFB_PID:-}" ]]; then
    kill "${RFB_PID}" 2> /dev/null || true
    wait "${RFB_PID}" 2> /dev/null || true
  fi
}

start_rfb_server() {
  local port_file="${BATS_TEST_TMPDIR}/rfb.port" i
  python3 -c '
import socket, sys
s = socket.socket()
s.bind(("127.0.0.1", 0))
s.listen()
open(sys.argv[1] + ".tmp", "w").write(str(s.getsockname()[1]))
__import__("os").rename(sys.argv[1] + ".tmp", sys.argv[1])
while True:
    c, _ = s.accept()
    c.sendall((sys.argv[2] + "\n").encode())
    c.close()
' "${port_file}" "$1" 3>&- &
  RFB_PID=$!
  for ((i = 0; i < 200; i++)); do
    [[ -s "${port_file}" ]] && break
    sleep 0.05
  done
  export TESSERACT_VNC_PORT="$(< "${port_file}")"
}

with_sdk() {
  export JAVA_HOME="${BATS_TEST_TMPDIR}/jdk" ANDROID_HOME="${BATS_TEST_TMPDIR}/sdk"
  mkdir -p "${JAVA_HOME}/bin" "${ANDROID_HOME}/platform-tools"
  stub java 'echo "openjdk version \"17.0.12\" 2024-07-16" >&2'
  stub adb 'echo "Android Debug Bridge version 1.0.41"'
  ln -s "${STUB_BIN}/java" "${JAVA_HOME}/bin/java"
  ln -s "${STUB_BIN}/adb" "${ANDROID_HOME}/platform-tools/adb"
}

row() {
  printf '%-15s %-6s %s' "$1" "$2" "$3"
}

@test "a healthy sandbox passes every check" {
  with_sdk
  TESSERACT_PORT=7711 run "${DOCTOR}"
  assert_success
  assert_line --index 0 "$(printf '%-15s %-6s %s' CHECK STATUS DETAIL)"
  assert_line "$(row display PASS ":1 1600x900")"
  assert_line "$(row window-manager PASS "openbox on :1")"
  assert_line "$(row vnc PASS "127.0.0.1:${TESSERACT_VNC_PORT} RFB 003.008")"
  assert_line "$(row controller PASS "http://127.0.0.1:7711 v1.2.3")"
  assert_line "$(row supervisor PASS "controller,openbox,wine-init,xvnc ok")"
  assert_line "$(row wine PASS "wine-10.0, prefix ${HOME}/.wine")"
  assert_line "$(row node PASS v24.1.0)"
  assert_line "$(row bun PASS 1.4.2)"
  assert_line "$(row claude PASS "2.1.0 (Claude Code)")"
  assert_line "$(row claude-auth PASS "logged in (${HOME}/.claude/.credentials.json)")"
  assert_line "$(row java PASS 'openjdk version "17.0.12" 2024-07-16')"
  assert_line "$(row adb PASS "Android Debug Bridge version 1.0.41")"
  assert_line "$(row docker SKIP "no DOCKER_HOST (start the stack with --dind)")"
  assert_line "$(row disk PASS "50 GiB free on ${TESSERACT_WORKSPACE}")"
  assert_line "$(row workspace PASS "${TESSERACT_WORKSPACE} writable by $(id -un)")"
  assert_line "$(row home PASS "${HOME} writable by $(id -un)")"
  assert_line "16 checks, 0 failed, 0 warnings"
  assert_equal "$(calls_of curl)" "-fsS --max-time 5 http://127.0.0.1:7711/v1/health"
  assert_equal "$(calls_of xdpyinfo)" "-display :1"
  run find "${TESSERACT_WORKSPACE}" "${HOME}" -name '.tesseract-doctor.*'
  assert_output ""
}

@test "without an X display: display fails, window manager warns, exit 1" {
  stub xdpyinfo 'exit 1'
  stub xprop 'exit 1'
  TESSERACT_DISPLAY=:5 run "${DOCTOR}"
  assert_failure 1
  assert_line "$(row display FAIL "cannot open X display :5 (supervisorctl status xvnc)")"
  assert_line "$(row window-manager WARN "no EWMH window manager on :5 (supervisorctl status openbox)")"
  assert_line --regexp '^16 checks, 1 failed, 1 warnings$'
}

@test "xdpyinfo without dimensions counts as no display" {
  stub xdpyinfo 'echo "name of display: :1"'
  run "${DOCTOR}"
  assert_failure 1
  assert_line --partial "display         FAIL"
}

@test "vnc fails when nothing listens or the server is not RFB" {
  kill "${RFB_PID}"
  wait "${RFB_PID}" 2> /dev/null || true
  RFB_PID=""
  run "${DOCTOR}"
  assert_failure 1
  assert_line "$(row vnc FAIL "no RFB server on 127.0.0.1:${TESSERACT_VNC_PORT}")"

  start_rfb_server "SSH-2.0-OpenSSH"
  run "${DOCTOR}"
  assert_failure 1
  assert_line "$(row vnc FAIL "no RFB server on 127.0.0.1:${TESSERACT_VNC_PORT}")"
}

@test "controller fails with curl's first error line" {
  stub curl 'printf "curl: (7) Failed to connect to 127.0.0.1 port 7700\nmore\n" >&2; exit 7'
  run "${DOCTOR}"
  assert_failure 1
  assert_line "$(row controller FAIL "curl: (7) Failed to connect to 127.0.0.1 port 7700")"
}

@test "controller passes without a version when the body is not JSON" {
  stub curl 'echo ok'
  run "${DOCTOR}"
  assert_line "$(row controller PASS "http://127.0.0.1:7700")"
}

@test "supervisor: STARTING programs only warn" {
  stub supervisorctl 'printf "%s\n" "controller  STARTING" "xvnc        RUNNING   pid 9"'
  run "${DOCTOR}"
  assert_success
  assert_line "$(row supervisor WARN "still starting: controller (run tesseract-doctor again in a few seconds)")"
}

@test "supervisor: stopped programs fail even though supervisorctl exits non-zero" {
  stub supervisorctl 'printf "%s\n" "controller  FATAL     Exited too quickly" "openbox     BACKOFF   Exited too quickly" "wine-init   EXITED    x" "xvnc        RUNNING   pid 9"; exit 3'
  run "${DOCTOR}"
  assert_failure 1
  assert_line "$(row supervisor FAIL "controller=FATAL, openbox=BACKOFF")"
}

@test "supervisor: an EXITED program other than wine-init fails" {
  stub supervisorctl 'printf "%s\n" "controller  EXITED    x" "wine-init   EXITED    x"'
  run "${DOCTOR}"
  assert_failure 1
  assert_line "$(row supervisor FAIL "controller=EXITED")"
}

@test "supervisor: an unreachable supervisord only warns" {
  stub supervisorctl 'echo "unix:///run/supervisor/supervisor.sock no such file"; exit 4'
  run "${DOCTOR}"
  assert_success
  assert_line "$(row supervisor WARN "supervisord not reachable: unix:///run/supervisor/supervisor.sock no such file")"
}

@test "wine: missing, broken and uninitialised prefix" {
  rm "${STUB_BIN}/wine"
  run env PATH="$(minimal_path)" "${DOCTOR}"
  assert_line "$(row wine FAIL "wine not found on PATH")"

  stub wine 'echo "wine: could not load kernel32.dll"; exit 1'
  run "${DOCTOR}"
  assert_line "$(row wine FAIL "wine: could not load kernel32.dll")"

  stub wine 'exit 1'
  run "${DOCTOR}"
  assert_line "$(row wine FAIL "wine --version failed")"

  stub wine 'echo wine-10.0'
  WINEPREFIX="${BATS_TEST_TMPDIR}/empty-prefix" run "${DOCTOR}"
  assert_line "$(row wine WARN "wine-10.0, prefix ${BATS_TEST_TMPDIR}/empty-prefix not initialised (supervisorctl status wine-init)")"
}

@test "tools: missing and failing tools fail" {
  rm "${STUB_BIN}/bun"
  stub node 'echo "node: bad option"; exit 9'
  run env PATH="$(minimal_path)" "${DOCTOR}"
  assert_failure 1
  assert_line "$(row node FAIL "node: bad option")"
  assert_line "$(row bun FAIL "bun not found on PATH")"
}

@test "claude-auth: only the host's mounted Claude Max login counts" {
  rm -f "${HOME}/.claude/.credentials.json"
  run "${DOCTOR}"
  assert_line "$(row claude-auth WARN "not authenticated: log in with 'claude' (Claude Max) on the host (its ~/.claude is mounted here)")"

  ANTHROPIC_API_KEY=key CLAUDE_CODE_OAUTH_TOKEN=tok run "${DOCTOR}"
  assert_line --partial "claude-auth     WARN"

  : > "${HOME}/.claude/.credentials.json"
  run "${DOCTOR}"
  assert_line --partial "claude-auth     WARN"

  echo '{}' > "${HOME}/.claude/.credentials.json"
  run "${DOCTOR}"
  assert_line --partial "claude-auth     WARN"

  echo '{"claudeAiOauth":{"accessToken":"x"}}' > "${HOME}/.claude/.credentials.json"
  run "${DOCTOR}"
  assert_line "$(row claude-auth PASS "logged in (${HOME}/.claude/.credentials.json)")"
}

@test "claude-auth: every extra account in TESSERACT_CLAUDE_ACCOUNTS is checked on its own mount" {
  mkdir -p "${HOME}/.claude-work" "${HOME}/.claude-personal"
  echo '{"claudeAiOauth":{"accessToken":"x"}}' > "${HOME}/.claude-work/.credentials.json"
  echo '{}' > "${HOME}/.claude-personal/.credentials.json"
  TESSERACT_CLAUDE_ACCOUNTS=work,personal,gone,Bad run "${DOCTOR}"
  assert_success
  assert_line "$(row claude-auth PASS "logged in (${HOME}/.claude/.credentials.json)")"
  assert_line "$(row claude-auth:work PASS "logged in (${HOME}/.claude-work/.credentials.json)")"
  assert_line "$(row claude-auth:personal WARN "not authenticated: log in with 'CLAUDE_CONFIG_DIR=~/.claude-personal claude' (Claude Max) on the host")"
  assert_line "$(row claude-auth:gone WARN "${HOME}/.claude-gone is not mounted (TESSERACT_HOST_CLAUDE_ACCOUNTS on the host)")"
  assert_line "$(row claude-auth:Bad WARN "invalid account name in TESSERACT_CLAUDE_ACCOUNTS")"

  run "${DOCTOR}"
  refute_output --partial "claude-auth:"
}

@test "android: images without the SDK skip java and adb" {
  run "${DOCTOR}"
  assert_success
  assert_line "$(row java SKIP "no JDK (image built with WITH_ANDROID=false)")"
  assert_line "$(row adb SKIP "no Android SDK (image built with WITH_ANDROID=false)")"
}

@test "docker: engine reachable passes, unreachable fails" {
  stub docker 'echo 29.8.1'
  DOCKER_HOST=tcp://docker:2376 run "${DOCTOR}"
  assert_success
  assert_line "$(row docker PASS "engine 29.8.1 at tcp://docker:2376")"
  assert_equal "$(calls_of docker)" "version --format \\{\\{.Server.Version\\}\\}"

  stub docker 'exit 1'
  DOCKER_HOST=tcp://docker:2376 run "${DOCTOR}"
  assert_failure 1
  assert_line "$(row docker FAIL "cannot reach tcp://docker:2376")"
}

@test "disk: under 2 GiB fails, under 10 GiB warns" {
  STUB_DF_KB=$((1 * 1024 * 1024 + 5)) run "${DOCTOR}"
  assert_failure 1
  assert_line "$(row disk FAIL "1 GiB free on ${TESSERACT_WORKSPACE}")"

  STUB_DF_KB=$((2 * 1024 * 1024)) run "${DOCTOR}"
  assert_success
  assert_line "$(row disk WARN "2 GiB free on ${TESSERACT_WORKSPACE}")"

  STUB_DF_KB=$((10 * 1024 * 1024)) run "${DOCTOR}"
  assert_line "$(row disk PASS "10 GiB free on ${TESSERACT_WORKSPACE}")"
  assert_equal "$(calls_of df | tail -n 1)" "-Pk ${TESSERACT_WORKSPACE}"
}

@test "writable: a missing workspace fails" {
  rm -rf "${TESSERACT_WORKSPACE}"
  stub df 'printf "h\n/dev/x 1 1 52428800 1%% /\n"'
  run "${DOCTOR}"
  assert_failure 1
  assert_line "$(row workspace FAIL "${TESSERACT_WORKSPACE} not writable by $(id -un)")"
}

@test "warnings alone never fail the run" {
  stub xprop 'exit 1'
  rm -f "${HOME}/.claude/.credentials.json"
  run "${DOCTOR}"
  assert_success
  assert_line "16 checks, 0 failed, 2 warnings"
}

@test "statuses are coloured on a terminal only" {
  stub xprop 'exit 1'
  stub bun 'exit 1'
  run script -qec "${DOCTOR}" /dev/null
  assert_failure
  assert_output --partial $'\e[32mPASS  \e[0m'
  assert_output --partial $'\e[33mWARN  \e[0m'
  assert_output --partial $'\e[31mFAIL  \e[0m'
  assert_output --partial $'\e[2mSKIP  \e[0m'

  run "${DOCTOR}"
  refute_output --partial $'\e['
}
