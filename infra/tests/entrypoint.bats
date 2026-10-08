#!/usr/bin/env bats
# tesseract-entrypoint as root inside a throwaway tesseract-test-* container (infra/tests/run):
# volume preparation, template seeding, secrets, symlink hardening and idempotency.

load lib/common

ENTRYPOINT="${ROOTFS_BIN}/tesseract-entrypoint"
TEMPLATES=/etc/tesseract/agent-templates
DEV_HOME=/home/dev

setup() {
  [[ -n "${TESSERACT_TEST_CONTAINER:-}" ]] || skip "runs as root in a throwaway container (infra/tests/run)"
  [[ "$(id -u)" == 0 ]] || skip "needs root"
  unset_tesseract_env
  unset XDG_RUNTIME_DIR
  WS="${BATS_TEST_TMPDIR}/workspace"
  AGENT="${WS}/.agent"
  export TESSERACT_WORKSPACE="${WS}"
  DEV_UID="$(id -u dev)"
  rm -rf "${DEV_HOME}/.vnc" "${DEV_HOME}/.claude" "${DEV_HOME}"/.claude-* /run/tesseract /run/supervisor /etc/tesseract-victim*
  TOOLS=/tmp/tesseract-test-tools
  rm -rf "${TOOLS}"
}

teardown() {
  rm -rf /etc/tesseract-victim* "${TOOLS:-/nonexistent}"
  if [[ -e /usr/bin/supervisord.tesseract-test ]]; then
    mv -f /usr/bin/supervisord.tesseract-test /usr/bin/supervisord
  elif [[ -n "${SUPERVISORD_STUBBED:-}" ]]; then
    rm -f /usr/bin/supervisord
  fi
}

entrypoint() {
  run "${ENTRYPOINT}" "${@:-true}"
}

owner_mode() {
  stat -c '%U:%G %a' "$1"
}

template_count() {
  find "${TEMPLATES}" -type f | wc -l
}

# A directory dev must never be able to reach through the volumes.
victim_dir() {
  install -d -o root -g root -m 0755 /etc/tesseract-victim-dir
  echo root-data > /etc/tesseract-victim-dir/keep
}

victim_file() {
  printf 'rootsecret\n' > /etc/tesseract-victim-file
  chown root:root /etc/tesseract-victim-file
  chmod 0600 /etc/tesseract-victim-file
}

@test "creates the workspace layout owned by dev" {
  entrypoint
  assert_success
  local dir
  for dir in "${WS}" "${WS}/projects" "${WS}/artifacts" "${AGENT}" "${AGENT}/projects" "${AGENT}/logs" "${AGENT}/logs/supervisor"; do
    assert_equal "$(owner_mode "${dir}")" "dev:dev 755"
  done
  assert_equal "$(owner_mode "${AGENT}/controller")" "dev:dev 700"
  assert_file_not_exists "${DEV_HOME}/.claude"
  assert_equal "$(owner_mode "${DEV_HOME}/.vnc")" "dev:dev 700"
  assert_equal "$(owner_mode "/run/user/${DEV_UID}")" "dev:dev 700"
  assert_equal "$(owner_mode /run/supervisor)" "dev:dev 700"
  assert_equal "$(owner_mode /tmp/.X11-unix)" "root:root 1777"
}

@test "seeds every agent template once, owned by dev" {
  entrypoint
  assert_success
  assert_output --partial "seeded $(template_count) agent memory file(s) into ${AGENT}"
  local src rel
  while IFS= read -r src; do
    rel="${src#"${TEMPLATES}"/}"
    assert_file_exists "${AGENT}/${rel}"
    assert_equal "$(owner_mode "${AGENT}/${rel}")" "dev:dev 644"
    cmp -s "${src}" "${AGENT}/${rel}"
  done < <(find "${TEMPLATES}" -type f)
  assert_dir_exists "${AGENT}/projects/_template"
}

@test "a second start seeds nothing, keeps edits and restores deleted files" {
  entrypoint
  echo "my notes" > "${AGENT}/GLOBAL_CONTEXT.md"
  rm "${AGENT}/DECISIONS.md"
  local before
  before="$(find "${WS}" "${DEV_HOME}/.vnc" ! -name ENVIRONMENT.md ! -name DECISIONS.md -printf '%p %u %g %m\n' | sort)"

  entrypoint
  assert_success
  assert_output --partial "seeded 1 agent memory file(s)"
  assert_equal "$(cat "${AGENT}/GLOBAL_CONTEXT.md")" "my notes"
  assert_file_exists "${AGENT}/DECISIONS.md"
  assert_equal "$(find "${WS}" "${DEV_HOME}/.vnc" ! -name ENVIRONMENT.md ! -name DECISIONS.md -printf '%p %u %g %m\n' | sort)" "${before}"

  entrypoint
  refute_output --partial "seeded"
  refute_output --partial "generated a VNC password"
  refute_output --partial "fixing ownership"
}

@test "never writes to ~/.claude (the host's Claude dir), even when fixing ownership" {
  install -d -o root -g root -m 0700 "${DEV_HOME}/.claude"
  echo '{}' > "${DEV_HOME}/.claude/.credentials.json"
  chown root:root "${DEV_HOME}/.claude/.credentials.json"
  chmod 0600 "${DEV_HOME}/.claude/.credentials.json"
  echo notes > "${DEV_HOME}/.bashrc.tesseract-test"
  chown root:root "${DEV_HOME}" "${DEV_HOME}/.bashrc.tesseract-test"
  entrypoint
  assert_success
  assert_output --partial "fixing ownership of ${DEV_HOME} for uid ${DEV_UID}"
  assert_equal "$(stat -c %U:%G "${DEV_HOME}")" dev:dev
  assert_equal "$(stat -c %U "${DEV_HOME}/.bashrc.tesseract-test")" dev
  assert_equal "$(owner_mode "${DEV_HOME}/.claude")" "root:root 700"
  assert_equal "$(owner_mode "${DEV_HOME}/.claude/.credentials.json")" "root:root 600"
  assert_equal "$(ls -A "${DEV_HOME}/.claude")" ".credentials.json"
  rm -f "${DEV_HOME}/.bashrc.tesseract-test"
}

@test "never writes to ~/.claude-<account> (extra host Claude dirs), even when fixing ownership" {
  local account
  for account in work personal; do
    install -d -o root -g root -m 0700 "${DEV_HOME}/.claude-${account}" "${DEV_HOME}/.claude-${account}/projects"
    echo '{}' > "${DEV_HOME}/.claude-${account}/.credentials.json"
    chmod 0600 "${DEV_HOME}/.claude-${account}/.credentials.json"
  done
  install -d -o root -g root -m 0755 "${DEV_HOME}/.claudex.tesseract-test"
  chown root:root "${DEV_HOME}"
  entrypoint
  assert_success
  assert_output --partial "fixing ownership of ${DEV_HOME} for uid ${DEV_UID}"
  assert_equal "$(stat -c %U "${DEV_HOME}/.claudex.tesseract-test")" dev
  for account in work personal; do
    assert_equal "$(owner_mode "${DEV_HOME}/.claude-${account}")" "root:root 700"
    assert_equal "$(owner_mode "${DEV_HOME}/.claude-${account}/projects")" "root:root 700"
    assert_equal "$(owner_mode "${DEV_HOME}/.claude-${account}/.credentials.json")" "root:root 600"
  done
  rm -rf "${DEV_HOME}/.claudex.tesseract-test"
}

@test "generates an 8 character VNC password once and reuses it" {
  entrypoint
  assert_output --partial "generated a VNC password (${DEV_HOME}/.vnc/password)"
  local password
  password="$(cat "${DEV_HOME}/.vnc/password")"
  [[ "${password}" =~ ^[A-Za-z0-9]{8}$ ]]
  assert_equal "$(owner_mode "${DEV_HOME}/.vnc/password")" "dev:dev 600"

  entrypoint
  refute_output --partial "generated a VNC password"
  assert_equal "$(cat "${DEV_HOME}/.vnc/password")" "${password}"
  assert_equal "$(grep '^TESSERACT_VNC_PASSWORD=' /run/tesseract/controller.env)" "TESSERACT_VNC_PASSWORD=${password}"
}

@test "writes the VNC auth file when vncpasswd exists" {
  command -v vncpasswd > /dev/null || skip "vncpasswd not installed in this image"
  entrypoint
  assert_equal "$(owner_mode "${DEV_HOME}/.vnc/passwd")" "dev:dev 600"
  assert_equal "$(stat -c %s "${DEV_HOME}/.vnc/passwd")" 8
}

@test "an empty stored password is replaced" {
  install -d -o dev -g dev -m 0700 "${DEV_HOME}/.vnc"
  : > "${DEV_HOME}/.vnc/password"
  entrypoint
  assert_output --partial "generated a VNC password"
  [[ "$(cat "${DEV_HOME}/.vnc/password")" =~ ^[A-Za-z0-9]{8}$ ]]
}

@test "TESSERACT_VNC_PASSWORD wins over the stored password and warns beyond 8 characters" {
  TESSERACT_VNC_PASSWORD=short1 entrypoint
  refute_output --partial "generated a VNC password"
  refute_output --partial "first 8 characters"
  assert_file_not_exists "${DEV_HOME}/.vnc/password"
  assert_equal "$(cat /run/tesseract/controller.env)" "TESSERACT_VNC_PASSWORD=short1"

  TESSERACT_VNC_PASSWORD=muchlongerpassword entrypoint
  assert_output --partial "VNC authentication only uses the first 8 characters of the password"
}

@test "controller.env is dev-only, root keeps its directory, secrets round-trip" {
  local password=$'p a$s\'"`x' token='tok;en $(touch /tmp/tesseract-pwned)'
  TESSERACT_VNC_PASSWORD="${password}" TESSERACT_TOKEN="${token}" entrypoint
  assert_success
  assert_equal "$(owner_mode /run/tesseract)" "root:root 755"
  assert_equal "$(owner_mode /run/tesseract/controller.env)" "dev:dev 600"
  run bash -c 'set -a; . /run/tesseract/controller.env; printf "%s\n%s" "${TESSERACT_VNC_PASSWORD}" "${TESSERACT_TOKEN}"'
  assert_output "${password}
${token}"
  assert_file_not_exists /tmp/tesseract-pwned
}

@test "TESSERACT_TOKEN only reaches controller.env when set" {
  entrypoint
  run grep -c TESSERACT_TOKEN /run/tesseract/controller.env
  assert_output 0
}

@test "empty TESSERACT_, ANTHROPIC_, CLAUDE_ and DOCKER_ variables are dropped" {
  run env TESSERACT_EMPTY= ANTHROPIC_API_KEY= CLAUDE_CODE_USE_BEDROCK= DOCKER_HOST= KEEP_EMPTY= TESSERACT_SET=v \
    "${ENTRYPOINT}" env
  assert_success
  refute_line "TESSERACT_EMPTY="
  refute_line "ANTHROPIC_API_KEY="
  refute_line "CLAUDE_CODE_USE_BEDROCK="
  refute_line "DOCKER_HOST="
  assert_line "KEEP_EMPTY="
  assert_line "TESSERACT_SET=v"
  run grep '| Docker |' "${AGENT}/ENVIRONMENT.md"
  assert_output "| Docker | not available (stack started without --dind) |"
}

@test "arguments replace supervisord" {
  run "${ENTRYPOINT}" sh -c 'echo "ran as $(id -un) with $#"' _ a b
  assert_success
  assert_line "ran as root with 2"
}

@test "without arguments supervisord starts without the secrets in its environment" {
  if [[ -e /usr/bin/supervisord ]]; then
    mv /usr/bin/supervisord /usr/bin/supervisord.tesseract-test
  fi
  SUPERVISORD_STUBBED=1
  cat > /usr/bin/supervisord << 'EOF'
#!/bin/sh
echo "supervisord $*"
echo "token=${TESSERACT_TOKEN-unset} password=${TESSERACT_VNC_PASSWORD-unset} stt=${TESSERACT_STT_API_KEY-unset} other=${TESSERACT_SANDBOX_ID-unset}"
EOF
  chmod +x /usr/bin/supervisord
  TESSERACT_TOKEN=secret-token TESSERACT_VNC_PASSWORD=secretpw TESSERACT_STT_API_KEY=sk-stt TESSERACT_SANDBOX_ID=box run "${ENTRYPOINT}"
  assert_success
  assert_line "supervisord -n -c /etc/supervisor/supervisord.conf"
  assert_line "token=unset password=unset stt=unset other=box"
  assert_equal "$(cat /run/tesseract/controller.env)" "TESSERACT_VNC_PASSWORD=secretpw
TESSERACT_TOKEN=secret-token
TESSERACT_STT_API_KEY=sk-stt"
}

@test "repairs the ownership of volumes created by root" {
  mkdir -p "${WS}/projects/app/src"
  touch "${WS}/projects/app/src/index.ts"
  entrypoint
  assert_output --partial "fixing ownership of ${WS} for uid ${DEV_UID}"
  assert_equal "$(stat -c %U "${WS}/projects/app/src/index.ts")" dev
}

@test "ownership repair never follows symlinks out of the volume" {
  victim_file
  mkdir -p "${WS}/projects"
  ln -s /etc/tesseract-victim-file "${WS}/projects/link"
  install -d -o root -g root "${WS}/.agent/logs/supervisor"
  ln -s /etc/tesseract-victim-file "${WS}/.agent/logs/supervisor/supervisord.log"
  entrypoint
  assert_success
  assert_equal "$(owner_mode /etc/tesseract-victim-file)" "root:root 600"
  assert_equal "$(stat -c %U "${WS}/projects")" dev
}

@test "symlinked directories in the volumes are replaced, never followed" {
  victim_dir
  install -d -o dev -g dev "${AGENT}" "${AGENT}/projects"
  chown dev:dev "${WS}"
  ln -s /etc/tesseract-victim-dir "${AGENT}/logs"
  ln -s /etc/tesseract-victim-dir "${AGENT}/controller"
  ln -s /etc/tesseract-victim-dir "${AGENT}/projects/_template"
  ln -s /etc/tesseract-victim-dir "${DEV_HOME}/.vnc"
  entrypoint
  assert_success
  local dir
  for dir in "${AGENT}/logs" "${AGENT}/controller" "${AGENT}/projects/_template" "${DEV_HOME}/.vnc"; do
    assert_not_symlink_to /etc/tesseract-victim-dir "${dir}"
    assert_dir_exists "${dir}"
    [[ ! -L "${dir}" ]]
  done
  assert_equal "$(owner_mode /etc/tesseract-victim-dir)" "root:root 755"
  assert_equal "$(ls -A /etc/tesseract-victim-dir)" "keep"
}

@test "a symlinked password file is neither read nor written through" {
  victim_file
  install -d -o dev -g dev -m 0700 "${DEV_HOME}/.vnc"
  ln -s /etc/tesseract-victim-file "${DEV_HOME}/.vnc/password"
  ln -s /etc/tesseract-victim-file "${DEV_HOME}/.vnc/passwd"
  entrypoint
  assert_success
  [[ ! -L "${DEV_HOME}/.vnc/password" ]]
  refute [ "$(cat "${DEV_HOME}/.vnc/password")" = rootsecret ]
  run grep -c rootsecret /run/tesseract/controller.env
  assert_output 0
  assert_equal "$(cat /etc/tesseract-victim-file)" "rootsecret"
  assert_equal "$(owner_mode /etc/tesseract-victim-file)" "root:root 600"
}

@test "dangling symlinks planted for seeded files are not written through" {
  install -d -o dev -g dev "${AGENT}"
  chown dev:dev "${WS}"
  ln -s /etc/tesseract-victim-planted "${AGENT}/GLOBAL_CONTEXT.md"
  install -d -o dev -g dev -m 0700 "${DEV_HOME}/.claude"
  ln -s /etc/tesseract-victim-claude "${DEV_HOME}/.claude/CLAUDE.md"
  entrypoint
  assert_success
  assert_file_not_exists /etc/tesseract-victim-planted
  assert_file_not_exists /etc/tesseract-victim-claude
  [[ ! -L "${AGENT}/GLOBAL_CONTEXT.md" ]]
  assert_equal "$(stat -c %U "${AGENT}/GLOBAL_CONTEXT.md")" dev
}

@test "a symlinked ENVIRONMENT.md is replaced, never written through" {
  victim_file
  install -d -o dev -g dev "${AGENT}"
  chown dev:dev "${WS}"
  ln -s /etc/tesseract-victim-file "${AGENT}/ENVIRONMENT.md"
  entrypoint
  assert_success
  [[ ! -L "${AGENT}/ENVIRONMENT.md" ]]
  assert_equal "$(cat /etc/tesseract-victim-file)" "rootsecret"
}

@test "removes the stale X lock and socket of the configured display" {
  mkdir -p /tmp/.X11-unix
  touch /tmp/.X7-lock /tmp/.X11-unix/X7 /tmp/.X8-lock
  TESSERACT_DISPLAY=:7.0 entrypoint
  assert_success
  assert_file_not_exists /tmp/.X7-lock
  assert_file_not_exists /tmp/.X11-unix/X7
  assert_file_exists /tmp/.X8-lock
  rm -f /tmp/.X8-lock
}

@test "ENVIRONMENT.md is regenerated on every start, dev-owned and read-only for others" {
  TESSERACT_SANDBOX_ID=first entrypoint
  assert_equal "$(owner_mode "${AGENT}/ENVIRONMENT.md")" "dev:dev 644"
  assert_file_contains "${AGENT}/ENVIRONMENT.md" '^| Sandbox id | first |$'

  TESSERACT_SANDBOX_ID=second DOCKER_HOST=tcp://docker:2376 TESSERACT_PUBLIC_URL=https://x.ts.net TESSERACT_PORT=7711 entrypoint
  run cat "${AGENT}/ENVIRONMENT.md"
  assert_line --index 0 "# Environment"
  assert_line "| Sandbox id | second |"
  assert_line "| Docker | tcp://docker:2376 |"
  assert_line "| Controller | http://127.0.0.1:7711 (public: https://x.ts.net) |"
  assert_line --regexp "^\| Workspace \| ${WS} \(.+ free\) \|$"
  assert_line --regexp '^\| Memory limit \| [0-9]+ GiB'
  assert_line --regexp '^\| node \| .+ \|$'
  assert_line --regexp '^\| tigervnc \| .+ \|$'
  run find "${AGENT}" -maxdepth 1 -name '.ENVIRONMENT.md.*'
  assert_output ""
}

@test "tool versions are probed as dev and reduced to their first line" {
  install -d -m 0755 "${TOOLS}"
  printf '#!/bin/sh\nprintf "%%s\\nsecond line\\n" "$(id -un)"\n' > "${TOOLS}/node"
  printf '#!/bin/sh\nexit 3\n' > "${TOOLS}/bun"
  printf '#!/bin/sh\nexit 0\n' > "${TOOLS}/git"
  chmod 0755 "${TOOLS}"/*
  PATH="${TOOLS}:${PATH}" entrypoint
  assert_success
  run cat "${AGENT}/ENVIRONMENT.md"
  assert_line "| node | dev |"
  assert_line "| bun | unavailable |"
  assert_line "| git | unavailable |"
}

@test "missing tools and packages are reported as not installed" {
  ! command -v mono > /dev/null || skip "mono is installed in this image"
  entrypoint
  assert_file_contains "${AGENT}/ENVIRONMENT.md" '^| mono | not installed |$'
  dpkg-query -W chromium > /dev/null 2>&1 || assert_file_contains "${AGENT}/ENVIRONMENT.md" '^| chromium | not installed |$'
}

@test "a failure to write ENVIRONMENT.md is logged and not fatal" {
  install -d -o dev -g dev "${AGENT}"
  chown dev:dev "${WS}"
  mkdir "${AGENT}/ENVIRONMENT.md"
  touch "${AGENT}/ENVIRONMENT.md/keep"
  run "${ENTRYPOINT}" echo started
  assert_success
  assert_line "[tesseract-entrypoint] could not write ${AGENT}/ENVIRONMENT.md"
  assert_line "started"
  run find "${AGENT}" -maxdepth 1 -name '.ENVIRONMENT.md.*'
  assert_output ""
}

@test "copies directories from before the rename once, as dev, and keeps the old ones" {
  rm -rf "${DEV_HOME}/.config/chromium-theone" "${DEV_HOME}/.config/chromium-tesseract"
  # dev copies, so it must reach the test workspace like it reaches /workspace.
  local dir="${WS}"
  while dir="${dir%/*}" && [[ -n "${dir}" ]]; do chmod o+x "${dir}"; done
  install -d -o dev -g dev "${WS}" "${WS}/.theone/uploads" "${DEV_HOME}/.config" "${DEV_HOME}/.config/chromium-theone/Default"
  echo upload > "${WS}/.theone/uploads/a.txt"
  echo prefs > "${DEV_HOME}/.config/chromium-theone/Default/Preferences"
  chown -R dev:dev "${WS}/.theone" "${DEV_HOME}/.config/chromium-theone"
  entrypoint
  assert_success
  assert_output --partial "copied ${WS}/.theone to ${WS}/.tesseract"
  assert_output --partial "copied ${DEV_HOME}/.config/chromium-theone to ${DEV_HOME}/.config/chromium-tesseract"
  assert_equal "$(cat "${WS}/.tesseract/uploads/a.txt")" upload
  assert_equal "$(owner_mode "${WS}/.tesseract/uploads/a.txt")" "dev:dev 644"
  assert_equal "$(cat "${DEV_HOME}/.config/chromium-tesseract/Default/Preferences")" prefs
  assert_file_exists "${WS}/.theone/uploads/a.txt"
  assert_file_exists "${DEV_HOME}/.config/chromium-theone/Default/Preferences"

  echo newer > "${WS}/.tesseract/uploads/a.txt"
  entrypoint
  assert_success
  refute_output --partial "copied "
  assert_equal "$(cat "${WS}/.tesseract/uploads/a.txt")" newer
  rm -rf "${DEV_HOME}/.config/chromium-theone" "${DEV_HOME}/.config/chromium-tesseract"
}

@test "a symlinked legacy directory is never copied" {
  victim_dir
  install -d -o dev -g dev "${WS}"
  ln -s /etc/tesseract-victim-dir "${WS}/.theone"
  entrypoint
  assert_success
  assert_file_not_exists "${WS}/.tesseract"
}
