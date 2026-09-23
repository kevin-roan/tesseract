#!/usr/bin/env bats
# theone-wait-x, theone-xvnc and theone-screenshot with stubbed X11 tools.

load lib/common

setup() {
  unset_theone_env
  setup_stubs
  export HOME="${BATS_TEST_TMPDIR}/home"
  mkdir -p "${HOME}" /tmp/.X11-unix
  DISPLAY_NUMBER=$((50 + RANDOM % 400))
}

teardown() {
  if [[ -n "${LIVE_PID:-}" ]]; then
    kill "${LIVE_PID}" 2> /dev/null || true
    wait "${LIVE_PID}" 2> /dev/null || true
  fi
  rm -f "/tmp/.X${DISPLAY_NUMBER}-lock" "/tmp/.X11-unix/X${DISPLAY_NUMBER}"
}

# --- theone-wait-x ------------------------------------------------------------

@test "wait-x: without a command prints the usage and exits 2" {
  run "${ROOTFS_BIN}/theone-wait-x"
  assert_failure 2
  assert_output "usage: theone-wait-x <command> [args...]"
}

@test "wait-x: execs the command with DISPLAY once the display answers" {
  stub xdpyinfo
  THEONE_DISPLAY=":${DISPLAY_NUMBER}" run "${ROOTFS_BIN}/theone-wait-x" sh -c 'echo "display=${DISPLAY} args=$*"' _ a "b c"
  assert_success
  assert_output "display=:${DISPLAY_NUMBER} args=a b c"
  assert_equal "$(calls_of xdpyinfo)" "-display :${DISPLAY_NUMBER}"
}

@test "wait-x: DISPLAY wins over THEONE_DISPLAY, :1 is the default" {
  stub xdpyinfo
  DISPLAY=:7 THEONE_DISPLAY=:8 run "${ROOTFS_BIN}/theone-wait-x" printenv DISPLAY
  assert_output ":7"
  run "${ROOTFS_BIN}/theone-wait-x" printenv DISPLAY
  assert_output ":1"
}

@test "wait-x: retries every half second until the display is up" {
  stub xdpyinfo '
count=$(($(cat "${BATS_TEST_TMPDIR}/tries" 2> /dev/null || echo 0) + 1))
echo "${count}" > "${BATS_TEST_TMPDIR}/tries"
((count >= 3))'
  stub sleep
  run "${ROOTFS_BIN}/theone-wait-x" true
  assert_success
  assert_equal "$(calls_of sleep)" "0.5
0.5"
}

@test "wait-x: gives up after THEONE_WAIT_X_TIMEOUT without running the command" {
  stub xdpyinfo 'exit 1'
  stub sleep
  THEONE_WAIT_X_TIMEOUT=0 run "${ROOTFS_BIN}/theone-wait-x" touch "${BATS_TEST_TMPDIR}/ran"
  assert_failure 1
  assert_output "theone-wait-x: display :1 is not ready"
  assert_file_not_exists "${BATS_TEST_TMPDIR}/ran"
}

# --- theone-xvnc --------------------------------------------------------------

xvnc_args() {
  local display=$1 id=$2
  printf '%s -geometry 1600x900 -depth 24 -rfbport 5901 -rfbauth %s/.vnc/passwd -SecurityTypes VncAuth -AlwaysShared -desktop %s -nolisten tcp' \
    "${display}" "${HOME}" "$(printf '%q' "TheOne ${id}")"
}

@test "xvnc: execs Xvnc with the defaults" {
  stub Xvnc
  HOSTNAME=box run "${ROOTFS_BIN}/theone-xvnc"
  assert_success
  assert_equal "$(calls_of Xvnc)" "$(xvnc_args :1 box)"
}

@test "xvnc: honours display, geometry, port and sandbox id" {
  stub Xvnc
  THEONE_DISPLAY=":${DISPLAY_NUMBER}" THEONE_DISPLAY_GEOMETRY=800x600 THEONE_VNC_PORT=5999 \
    THEONE_SANDBOX_ID=theone-sandbox run "${ROOTFS_BIN}/theone-xvnc"
  assert_success
  assert_equal "$(calls_of Xvnc)" \
    ":${DISPLAY_NUMBER} -geometry 800x600 -depth 24 -rfbport 5999 -rfbauth ${HOME}/.vnc/passwd -SecurityTypes VncAuth -AlwaysShared -desktop TheOne\\ theone-sandbox -nolisten tcp"
}

stale_lock_is_removed() {
  stub Xvnc
  touch "/tmp/.X11-unix/X${DISPLAY_NUMBER}"
  THEONE_DISPLAY=":${DISPLAY_NUMBER}.0" run "${ROOTFS_BIN}/theone-xvnc"
  assert_success
  assert_file_not_exists "/tmp/.X${DISPLAY_NUMBER}-lock"
  assert_file_not_exists "/tmp/.X11-unix/X${DISPLAY_NUMBER}"
}

@test "xvnc: removes a lock that holds no pid" {
  printf 'garbage\n' > "/tmp/.X${DISPLAY_NUMBER}-lock"
  stale_lock_is_removed
}

@test "xvnc: removes the lock of a dead process" {
  sh -c 'exit 0' &
  local pid=$!
  wait "${pid}"
  printf '%10d\n' "${pid}" > "/tmp/.X${DISPLAY_NUMBER}-lock"
  stale_lock_is_removed
}

@test "xvnc: removes a lock whose pid now belongs to another program" {
  printf '%10d\n' "$$" > "/tmp/.X${DISPLAY_NUMBER}-lock"
  stale_lock_is_removed
}

@test "xvnc: keeps the lock of a live Xvnc" {
  stub Xvnc
  mkdir -p "${BATS_TEST_TMPDIR}/live"
  cp "$(command -v sleep)" "${BATS_TEST_TMPDIR}/live/Xvnc"
  "${BATS_TEST_TMPDIR}/live/Xvnc" 60 3>&- &
  LIVE_PID=$!
  local i
  for ((i = 0; i < 200; i++)); do
    [[ "$(cat "/proc/${LIVE_PID}/comm" 2> /dev/null)" == Xvnc ]] && break
    sleep 0.01
  done
  assert_equal "$(cat "/proc/${LIVE_PID}/comm")" Xvnc
  printf '%10d\n' "${LIVE_PID}" > "/tmp/.X${DISPLAY_NUMBER}-lock"
  touch "/tmp/.X11-unix/X${DISPLAY_NUMBER}"
  THEONE_DISPLAY=":${DISPLAY_NUMBER}" run "${ROOTFS_BIN}/theone-xvnc"
  assert_success
  assert_file_exists "/tmp/.X${DISPLAY_NUMBER}-lock"
  assert_file_exists "/tmp/.X11-unix/X${DISPLAY_NUMBER}"
}

# --- theone-screenshot --------------------------------------------------------

@test "screenshot: -h prints the usage" {
  run "${ROOTFS_BIN}/theone-screenshot" -h
  assert_success
  assert_line --index 0 "Usage: theone-screenshot [-d DISPLAY] [-w WINDOW_NAME] [OUTPUT]"
}

@test "screenshot: unknown options, missing option values and extra arguments exit 2" {
  local args
  for args in "-x" "-d" "a.png b.png"; do
    run "${ROOTFS_BIN}/theone-screenshot" ${args}
    assert_failure 2
    assert_line --index 0 --partial "Usage: theone-screenshot"
  done
  assert_equal "$(calls)" ""
}

@test "screenshot: captures the root window into a timestamped file by default" {
  stub import 'printf "%s\n" "${DISPLAY}" > "${BATS_TEST_TMPDIR}/display"'
  THEONE_DISPLAY=:4 run "${ROOTFS_BIN}/theone-screenshot"
  assert_success
  assert_output --regexp '^/tmp/theone-screenshots/[0-9]{8}T[0-9]{6}Z\.png$'
  assert_equal "$(calls_of import)" "-silent -window root png:${output}"
  assert_equal "$(cat "${BATS_TEST_TMPDIR}/display")" ":4"
  assert_dir_exists /tmp/theone-screenshots
}

@test "screenshot: writes to OUTPUT, creating its directory, on the -d display" {
  stub import 'printf "%s\n" "${DISPLAY}" > "${BATS_TEST_TMPDIR}/display"'
  local out="${BATS_TEST_TMPDIR}/a/b/shot.png"
  run "${ROOTFS_BIN}/theone-screenshot" -d :9 "${out}"
  assert_success
  assert_output "${out}"
  assert_dir_exists "${BATS_TEST_TMPDIR}/a/b"
  assert_equal "$(cat "${BATS_TEST_TMPDIR}/display")" ":9"
}

@test "screenshot: - streams the PNG to stdout without printing a path" {
  stub import 'printf PNGDATA'
  run "${ROOTFS_BIN}/theone-screenshot" -
  assert_success
  assert_output "PNGDATA"
  assert_equal "$(calls_of import)" "-silent -window root png:-"
}

@test "screenshot: -w captures the first visible matching window" {
  stub xdotool 'printf "4194307\n4194320\n"'
  stub import
  run "${ROOTFS_BIN}/theone-screenshot" -d :2 -w 'Electron.*' "${BATS_TEST_TMPDIR}/w.png"
  assert_success
  assert_equal "$(calls_of xdotool)" "search --onlyvisible --name Electron.\\*"
  assert_equal "$(calls_of import)" "-silent -window 4194307 png:${BATS_TEST_TMPDIR}/w.png"
}

@test "screenshot: -w fails when no window matches" {
  stub xdotool 'exit 1'
  stub import
  run "${ROOTFS_BIN}/theone-screenshot" -d :2 -w nothing
  assert_failure 1
  assert_output "theone-screenshot: no visible window matches 'nothing' on :2"
  assert_equal "$(calls_of import)" ""
}

@test "screenshot: a failing capture fails without printing a path" {
  stub import 'exit 1'
  run "${ROOTFS_BIN}/theone-screenshot" "${BATS_TEST_TMPDIR}/x.png"
  assert_failure 1
  assert_output ""
}
