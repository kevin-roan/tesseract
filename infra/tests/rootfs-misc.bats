#!/usr/bin/env bats
# tesseract-controller-run, tesseract-wine-init, /etc/profile.d/tesseract.sh, /etc/chromium.d/tesseract and the Claude Code managed settings and memory.

load lib/common

setup() {
  unset_tesseract_env
  setup_stubs
  export HOME="${BATS_TEST_TMPDIR}/home"
  mkdir -p "${HOME}"
}

teardown() {
  if [[ -n "${TESSERACT_TEST_CONTAINER:-}" ]]; then
    rm -f /usr/local/bin/tesseract-controller /run/tesseract/controller.env
  fi
}

# tesseract-controller-run hard-codes /run/tesseract and /usr/local/bin: only inside the
# throwaway test container.
require_container() {
  [[ -n "${TESSERACT_TEST_CONTAINER:-}" ]] || skip "writes /run/tesseract and /usr/local/bin (set TESSERACT_TEST_CONTAINER=1 in a throwaway container)"
  [[ ! -e /usr/local/bin/tesseract-controller ]] || skip "a real tesseract-controller is installed"
  mkdir -p /run/tesseract
  cat > /usr/local/bin/tesseract-controller << 'EOF'
#!/usr/bin/env bash
printf 'args=%s\n' "$*"
printf 'password=[%s]\n' "${TESSERACT_VNC_PASSWORD-unset}"
printf 'token=[%s]\n' "${TESSERACT_TOKEN-unset}"
bash -c 'printf "exported=[%s]\n" "${TESSERACT_VNC_PASSWORD-unset}"'
EOF
  chmod +x /usr/local/bin/tesseract-controller
}

@test "controller-run: execs tesseract-controller serve without an env file" {
  require_container
  rm -f /run/tesseract/controller.env
  run "${ROOTFS_BIN}/tesseract-controller-run"
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
    printf 'TESSERACT_VNC_PASSWORD=%q\n' "${password}"
    printf 'TESSERACT_TOKEN=%q\n' "${token}"
  } > /run/tesseract/controller.env
  run "${ROOTFS_BIN}/tesseract-controller-run"
  assert_success
  assert_output "args=serve
password=[${password}]
token=[${token}]
exported=[${password}]"
}

@test "controller-run: an unreadable env file is skipped" {
  require_container
  [[ "$(id -u)" == 0 ]] || skip "needs root to hide the file from dev"
  printf 'TESSERACT_TOKEN=x\n' > /run/tesseract/controller.env
  chmod 0600 /run/tesseract/controller.env
  chmod 0755 /usr/local/bin/tesseract-controller
  run runuser -u dev -- env HOME=/tmp "${ROOTFS_BIN}/tesseract-controller-run"
  assert_success
  assert_line "token=[unset]"
}

@test "wine-init: does nothing when wine is not installed" {
  stub wineboot
  PATH="${STUB_BIN}" run /bin/bash "${ROOTFS_BIN}/tesseract-wine-init"
  assert_success
  assert_output "wine is not installed; nothing to do"
  assert_equal "$(calls)" ""
}

@test "wine-init: leaves an existing prefix alone" {
  stub wine
  stub wineboot
  mkdir -p "${HOME}/.wine"
  touch "${HOME}/.wine/system.reg"
  run "${ROOTFS_BIN}/tesseract-wine-init"
  assert_success
  assert_output "wine prefix ready: ${HOME}/.wine"
  assert_equal "$(calls)" ""
}

@test "wine-init: creates the prefix with mono and gecko disabled" {
  stub wine
  stub wineboot 'printf "%s\n" "${WINEDLLOVERRIDES}" > "${BATS_TEST_TMPDIR}/overrides"'
  stub wineserver
  WINEPREFIX="${BATS_TEST_TMPDIR}/prefix" WINEARCH=win32 run "${ROOTFS_BIN}/tesseract-wine-init"
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
  run "${ROOTFS_BIN}/tesseract-wine-init"
  assert_failure 5
  assert_output "creating wine prefix ${HOME}/.wine (WINEARCH=win64)"
  assert_equal "$(calls_of wineserver)" ""
}

# --- /etc/profile.d/tesseract.sh (POSIX sh) --------------------------------------

profile() {
  run env -i HOME="${HOME}" PATH="${BASE_PATH:-/usr/bin:/bin}" ${JAVA_HOME:+JAVA_HOME="${JAVA_HOME}"} \
    ${ANDROID_HOME:+ANDROID_HOME="${ANDROID_HOME}"} ${DISPLAY:+DISPLAY="${DISPLAY}"} \
    ${TESSERACT_DISPLAY:+TESSERACT_DISPLAY="${TESSERACT_DISPLAY}"} ${TESSERACT_DATA_DIR:+TESSERACT_DATA_DIR="${TESSERACT_DATA_DIR}"} \
    sh ${SH_FLAGS:-} -c ". '${ROOTFS}/etc/profile.d/tesseract.sh'; $1"
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
    profile ". '${ROOTFS}/etc/profile.d/tesseract.sh'; echo \"\${PATH}\""
  assert_output "${HOME}/.local/bin:/opt/jdk/bin:/usr/bin:${HOME}/.bun/bin:/opt/sdk/platform-tools:/bin:/opt/sdk/cmdline-tools/latest/bin"
}

@test "profile: exports PATH and removes its helper functions" {
  profile 'sh -c "echo \"\${PATH}\""; command -v tesseract_path_prepend || echo gone; command -v tesseract_path_append || echo gone'
  assert_output "${HOME}/.local/bin:${HOME}/.bun/bin:/usr/bin:/bin
gone
gone"
}

@test "profile: only interactive shells get DISPLAY" {
  profile 'echo "display=${DISPLAY-unset}"'
  assert_output "display=unset"

  SH_FLAGS=-i profile 'echo "display=${DISPLAY-unset}"'
  assert_output --partial "display=:1"

  TESSERACT_DISPLAY=:3 SH_FLAGS=-i profile 'echo "display=${DISPLAY}"; sh -c "echo child=\${DISPLAY}"'
  assert_line --partial "display=:3"
  assert_line --partial "child=:3"

  DISPLAY=:9 TESSERACT_DISPLAY=:3 SH_FLAGS=-i profile 'echo "display=${DISPLAY}"'
  assert_output --partial "display=:9"
}

@test "profile: never exports a Claude token" {
  export TESSERACT_DATA_DIR="${BATS_TEST_TMPDIR}/data"
  mkdir -p "${TESSERACT_DATA_DIR}"
  printf 'sk-ant-oat01-stored\n' > "${TESSERACT_DATA_DIR}/claude-oauth-token"
  profile 'echo "token=${CLAUDE_CODE_OAUTH_TOKEN-unset}"'
  assert_output "token=unset"
}

# --- /etc/chromium.d/tesseract (Chromium flags; DevTools endpoint for GET /v1/display/browser) ---

@test "chromium: exposes DevTools on loopback with a non-default profile" {
  run env -i HOME=/home/dev CHROMIUM_FLAGS=--existing sh -c '. "$1"; printf "%s\n" "${CHROMIUM_FLAGS}"' chromium "${ROOTFS}/etc/chromium.d/tesseract"
  assert_success
  assert_output "--existing --no-sandbox --password-store=basic --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --user-data-dir=/home/dev/.config/chromium-tesseract"
  run env -i HOME=/home/dev TESSERACT_CHROMIUM_DEBUG_PORT=9333 sh -c '. "$1"; printf "%s\n" "${CHROMIUM_FLAGS}"' chromium "${ROOTFS}/etc/chromium.d/tesseract"
  assert_output --partial "--remote-debugging-port=9333 "
}

# --- /etc/claude-code/managed-settings.json (Claude Code hooks → controller inbox) ---

MANAGED_SETTINGS="${ROOTFS}/etc/claude-code/managed-settings.json"

@test "claude settings: managed-settings.json is a JSON object with only hooks" {
  run jq -e 'type == "object" and (keys == ["hooks"])' "${MANAGED_SETTINGS}"
  assert_success
}

@test "claude settings: Notification, Stop, StopFailure and UserPromptSubmit run tesseract-controller hook" {
  run jq -r '.hooks | keys | join(" ")' "${MANAGED_SETTINGS}"
  assert_output "Notification Stop StopFailure UserPromptSubmit"
  run jq -r '[.hooks[][] | select(has("matcher") | not) | .hooks[] | "\(.type) \(.command) \(.timeout)"] | unique | join("\n")' "${MANAGED_SETTINGS}"
  assert_output "command /usr/local/bin/tesseract-controller hook 5"
  run jq -r '[.hooks[] | length] | unique | join(" ")' "${MANAGED_SETTINGS}"
  assert_output "1"
}

@test "claude settings: the image puts the rootfs and the controller where the hooks expect them" {
  local dockerfile="${REPO}/infra/docker/sandbox/Dockerfile"
  grep -qx 'COPY infra/docker/sandbox/rootfs/ /' "${dockerfile}"
  grep -q ' /usr/local/bin/tesseract-controller$' "${dockerfile}"
}

# --- /etc/claude-code/CLAUDE.md (managed memory: share deliverables with the app) ---

@test "claude memory: CLAUDE.md tells Claude to share deliverables with a command the controller has" {
  local memory="${ROOTFS}/etc/claude-code/CLAUDE.md"
  [[ -s "${memory}" ]]
  grep -q 'tesseract-controller share <file> --note' "${memory}"
  grep -q 'tesseract-controller share <file> \[--project <id>\] \[--name <name>\] \[--note <text>\]' "${REPO}/apps/controller/src/cli/commands.ts"
}

# --- /etc/claude-code/.claude/skills/send-file (managed /send-file skill) ---

SEND_FILE="${ROOTFS}/etc/claude-code/.claude/skills/send-file"

@test "send-file: SKILL.md is named send-file and shares with tesseract-controller share" {
  run sed -n '2p' "${SEND_FILE}/SKILL.md"
  assert_output "name: send-file"
  grep -q 'tesseract-controller share "<file>" --note' "${SEND_FILE}/SKILL.md"
  grep -qF '${CLAUDE_SKILL_DIR}/find-files' "${SEND_FILE}/SKILL.md"
}

@test "send-file: the image makes find-files executable" {
  grep -q 'chmod 0755 .*/etc/claude-code/.claude/skills/send-file/find-files' "${REPO}/infra/docker/sandbox/Dockerfile"
}

@test "send-file: find-files lists matches newest first and skips build intermediates" {
  local dir="${BATS_TEST_TMPDIR}/proj"
  mkdir -p "${dir}/out" "${dir}/node_modules/x" "${dir}/build/intermediates"
  touch -d '2026-01-01 10:00' "${dir}/out/old.apk"
  touch -d '2026-01-02 10:00' "${dir}/out/new.aab"
  touch "${dir}/node_modules/x/dep.apk" "${dir}/build/intermediates/tmp.apk" "${dir}/README.md"
  run "${SEND_FILE}/find-files" android "${dir}"
  assert_success
  assert_line --index 0 --partial "2026-01-02T10:00 0 ${dir}/out/new.aab"
  assert_line --index 1 --partial "${dir}/out/old.apk"
  assert_equal "${#lines[@]}" 2
  run "${SEND_FILE}/find-files" android "${dir}" 1
  assert_success
  assert_output "2026-01-02T10:00 0 ${dir}/out/new.aab"
  run "${SEND_FILE}/find-files" README.md "${dir}"
  assert_output --partial "${dir}/README.md"
  run "${SEND_FILE}/find-files" '*.pdf' "${dir}"
  assert_success
  assert_output ""
}

@test "send-file: find-files rejects bad arguments" {
  run "${SEND_FILE}/find-files"
  assert_failure 2
  run "${SEND_FILE}/find-files" md "${BATS_TEST_TMPDIR}/missing"
  assert_failure 2
  run "${SEND_FILE}/find-files" md "${BATS_TEST_TMPDIR}" 0
  assert_failure 2
}

@test "claude memory: the image prepends SPEC.md to the managed CLAUDE.md, never ~/.claude" {
  local dockerfile="${REPO}/infra/docker/sandbox/Dockerfile"
  grep -qx 'COPY SPEC.md /etc/tesseract/SPEC.md' "${dockerfile}"
  grep -qF '{ cat /etc/tesseract/SPEC.md; printf '"'"'\n'"'"'; cat /etc/claude-code/CLAUDE.md; }' "${dockerfile}"
  run grep -n '\.claude' "${ROOTFS}/usr/local/bin/tesseract-entrypoint"
  assert_output --partial 'prune'
  refute_output --partial 'CLAUDE.md'
}
