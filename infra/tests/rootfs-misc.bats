#!/usr/bin/env bats
# theone-controller-run, theone-wine-init and /etc/profile.d/theone.sh.

load lib/common

setup() {
  unset_theone_env
  setup_stubs
  export HOME="${BATS_TEST_TMPDIR}/home"
  mkdir -p "${HOME}"
}

teardown() {
  if [[ -n "${THEONE_TEST_CONTAINER:-}" ]]; then
    rm -f /usr/local/bin/theone-controller /run/theone/controller.env
  fi
}

# theone-controller-run hard-codes /run/theone and /usr/local/bin: only inside the
# throwaway test container.
require_container() {
  [[ -n "${THEONE_TEST_CONTAINER:-}" ]] || skip "writes /run/theone and /usr/local/bin (set THEONE_TEST_CONTAINER=1 in a throwaway container)"
  [[ ! -e /usr/local/bin/theone-controller ]] || skip "a real theone-controller is installed"
  mkdir -p /run/theone
  cat > /usr/local/bin/theone-controller << 'EOF'
#!/usr/bin/env bash
printf 'args=%s\n' "$*"
printf 'password=[%s]\n' "${THEONE_VNC_PASSWORD-unset}"
printf 'token=[%s]\n' "${THEONE_TOKEN-unset}"
bash -c 'printf "exported=[%s]\n" "${THEONE_VNC_PASSWORD-unset}"'
EOF
  chmod +x /usr/local/bin/theone-controller
}

@test "controller-run: execs theone-controller serve without an env file" {
  require_container
  rm -f /run/theone/controller.env
  run "${ROOTFS_BIN}/theone-controller-run"
  assert_success
  assert_output "args=serve
password=[unset]
token=[unset]
exported=[unset]"
}

@test "controller-run: exports the variables of the %q env file written by the entrypoint" {
  require_container
  local password=$'p a$s\'"`x' token='tok;en $(id)'
  {
    printf 'THEONE_VNC_PASSWORD=%q\n' "${password}"
    printf 'THEONE_TOKEN=%q\n' "${token}"
  } > /run/theone/controller.env
  run "${ROOTFS_BIN}/theone-controller-run"
  assert_success
  assert_output "args=serve
password=[${password}]
token=[${token}]
exported=[${password}]"
}

@test "controller-run: an unreadable env file is skipped" {
  require_container
  [[ "$(id -u)" == 0 ]] || skip "needs root to hide the file from dev"
  printf 'THEONE_TOKEN=x\n' > /run/theone/controller.env
  chmod 0600 /run/theone/controller.env
  chmod 0755 /usr/local/bin/theone-controller
  run runuser -u dev -- env HOME=/tmp "${ROOTFS_BIN}/theone-controller-run"
  assert_success
  assert_line "token=[unset]"
}

@test "wine-init: does nothing when wine is not installed" {
  stub wineboot
  PATH="${STUB_BIN}" run /bin/bash "${ROOTFS_BIN}/theone-wine-init"
  assert_success
  assert_output "wine is not installed; nothing to do"
  assert_equal "$(calls)" ""
}

@test "wine-init: leaves an existing prefix alone" {
  stub wine
  stub wineboot
  mkdir -p "${HOME}/.wine"
  touch "${HOME}/.wine/system.reg"
  run "${ROOTFS_BIN}/theone-wine-init"
  assert_success
  assert_output "wine prefix ready: ${HOME}/.wine"
  assert_equal "$(calls)" ""
}

@test "wine-init: creates the prefix with mono and gecko disabled" {
  stub wine
  stub wineboot 'printf "%s\n" "${WINEDLLOVERRIDES}" > "${BATS_TEST_TMPDIR}/overrides"'
  stub wineserver
  WINEPREFIX="${BATS_TEST_TMPDIR}/prefix" WINEARCH=win32 run "${ROOTFS_BIN}/theone-wine-init"
  assert_success
  assert_output "creating wine prefix ${BATS_TEST_TMPDIR}/prefix (WINEARCH=win32)
wine prefix created: ${BATS_TEST_TMPDIR}/prefix"
  assert_equal "$(calls)" "wineboot -u
wineserver -w"
  assert_equal "$(cat "${BATS_TEST_TMPDIR}/overrides")" "mscoree,mshtml="
}

@test "wine-init: defaults to ~/.wine and win64, and fails when wineboot fails" {
  stub wine
  stub wineboot 'exit 5'
  stub wineserver
  run "${ROOTFS_BIN}/theone-wine-init"
  assert_failure 5
  assert_output "creating wine prefix ${HOME}/.wine (WINEARCH=win64)"
  assert_equal "$(calls_of wineserver)" ""
}

# --- /etc/profile.d/theone.sh (POSIX sh) --------------------------------------

profile() {
  run env -i HOME="${HOME}" PATH="${BASE_PATH:-/usr/bin:/bin}" ${JAVA_HOME:+JAVA_HOME="${JAVA_HOME}"} \
    ${ANDROID_HOME:+ANDROID_HOME="${ANDROID_HOME}"} ${DISPLAY:+DISPLAY="${DISPLAY}"} \
    ${THEONE_DISPLAY:+THEONE_DISPLAY="${THEONE_DISPLAY}"} \
    sh ${SH_FLAGS:-} -c ". '${ROOTFS}/etc/profile.d/theone.sh'; $1"
}

@test "profile: puts ~/.local/bin and ~/.bun/bin first" {
  profile 'echo "${PATH}"'
  assert_success
  assert_output "${HOME}/.local/bin:${HOME}/.bun/bin:/usr/bin:/bin"
}

@test "profile: prepends JAVA_HOME/bin and appends the Android SDK tools" {
  JAVA_HOME=/opt/jdk ANDROID_HOME=/opt/sdk profile 'echo "${PATH}"'
  assert_output "${HOME}/.local/bin:${HOME}/.bun/bin:/opt/jdk/bin:/usr/bin:/bin:/opt/sdk/cmdline-tools/latest/bin:/opt/sdk/platform-tools"
}

@test "profile: is idempotent and never duplicates PATH entries" {
  BASE_PATH="/usr/bin:${HOME}/.bun/bin:/opt/sdk/platform-tools:/bin" JAVA_HOME=/opt/jdk ANDROID_HOME=/opt/sdk \
    profile ". '${ROOTFS}/etc/profile.d/theone.sh'; echo \"\${PATH}\""
  assert_output "${HOME}/.local/bin:/opt/jdk/bin:/usr/bin:${HOME}/.bun/bin:/opt/sdk/platform-tools:/bin:/opt/sdk/cmdline-tools/latest/bin"
}

@test "profile: exports PATH and removes its helper functions" {
  profile 'sh -c "echo \"\${PATH}\""; command -v theone_path_prepend || echo gone; command -v theone_path_append || echo gone'
  assert_output "${HOME}/.local/bin:${HOME}/.bun/bin:/usr/bin:/bin
gone
gone"
}

@test "profile: only interactive shells get DISPLAY" {
  profile 'echo "display=${DISPLAY-unset}"'
  assert_output "display=unset"

  SH_FLAGS=-i profile 'echo "display=${DISPLAY-unset}"'
  assert_output --partial "display=:1"

  THEONE_DISPLAY=:3 SH_FLAGS=-i profile 'echo "display=${DISPLAY}"; sh -c "echo child=\${DISPLAY}"'
  assert_line --partial "display=:3"
  assert_line --partial "child=:3"

  DISPLAY=:9 THEONE_DISPLAY=:3 SH_FLAGS=-i profile 'echo "display=${DISPLAY}"'
  assert_output --partial "display=:9"
}
