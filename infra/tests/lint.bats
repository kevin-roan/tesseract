#!/usr/bin/env bats
# Static checks: syntax and shellcheck for every infra shell script, and consistency
# between the supervisord programs and the rootfs.

load lib/common

bash_scripts() {
  printf '%s\n' \
    "${REPO}/infra/scripts/sandbox" \
    "${REPO}/infra/scripts/deploy-mac" \
    "${REPO}/infra/e2e/run" \
    "${REPO}/infra/e2e/web/run" \
    "${REPO}/infra/tests/run" \
    "${ROOTFS_BIN}"/tesseract-* \
    "${ROOTFS_BIN}/tesseract" \
    "${ROOTFS}/etc/claude-code/.claude/skills/send-file/find-files"
}

sh_scripts() {
  printf '%s\n' \
    "${ROOTFS}/etc/profile.d/tesseract.sh" \
    "${ROOTFS}/etc/chromium.d/tesseract" \
    "${ROOTFS}/etc/xdg/openbox/autostart"
}

@test "every bash script parses and is executable" {
  local script
  while IFS= read -r script; do
    run bash -n "${script}"
    assert_success
    assert_file_executable "${script}"
    assert_equal "$(head -n 1 "${script}")" "#!/usr/bin/env bash"
  done < <(bash_scripts)
}

@test "every bash script runs with errexit, nounset and pipefail" {
  local script
  while IFS= read -r script; do
    grep -qx 'set -euo pipefail' "${script}" || fail "${script} lacks set -euo pipefail"
  done < <(bash_scripts)
}

@test "the sh snippets parse as POSIX sh" {
  local script
  while IFS= read -r script; do
    run sh -n "${script}"
    assert_success
  done < <(sh_scripts)
}

@test "shellcheck reports no warnings" {
  command -v shellcheck > /dev/null || skip "shellcheck not installed"
  run shellcheck --severity=warning $(bash_scripts) $(sh_scripts)
  assert_success
}

@test "every supervisord program command exists in the rootfs or the image" {
  local conf command
  for conf in "${ROOTFS}"/etc/supervisor/conf.d/*.conf; do
    command="$(sed -n 's/^command=\([^ ]*\).*/\1/p' "${conf}")"
    [[ -n "${command}" ]] || fail "${conf} has no command"
    if [[ "${command}" == /usr/local/bin/tesseract-* && "${command}" != /usr/local/bin/tesseract-controller ]]; then
      assert_file_executable "${ROOTFS}${command}"
    fi
  done
}

@test "every supervisord program runs as dev and logs into the directory the entrypoint prepares" {
  local conf
  for conf in "${ROOTFS}"/etc/supervisor/conf.d/*.conf "${ROOTFS}/etc/supervisor/supervisord.conf"; do
    grep -qx 'user=dev' "${conf}" || fail "${conf} does not run as dev"
    run grep -E '^(stdout_)?logfile=|^childlogdir=' "${conf}"
    local line
    for line in "${lines[@]}"; do
      [[ "${line#*=}" == /workspace/.agent/logs/supervisor* ]] || fail "${conf}: ${line}"
    done
  done
  grep -q '"${AGENT_DIR}/logs/supervisor"' "${ROOTFS_BIN}/tesseract-entrypoint"
}

@test "the supervisord socket lives in the directory the entrypoint hands to dev" {
  grep -qx 'file=/run/supervisor/supervisor.sock' "${ROOTFS}/etc/supervisor/supervisord.conf"
  grep -qx 'readonly SUPERVISOR_RUN_DIR=/run/supervisor' "${ROOTFS_BIN}/tesseract-entrypoint"
}
