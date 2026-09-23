#!/usr/bin/env bats
# theone-entrypoint as root inside a throwaway theone-test-* container (infra/tests/run):
# volume preparation, template seeding, secrets, symlink hardening and idempotency.

load lib/common

ENTRYPOINT="${ROOTFS_BIN}/theone-entrypoint"
TEMPLATES=/etc/theone/agent-templates
DEV_HOME=/home/dev

setup() {
  [[ -n "${THEONE_TEST_CONTAINER:-}" ]] || skip "runs as root in a throwaway container (infra/tests/run)"
  [[ "$(id -u)" == 0 ]] || skip "needs root"
  unset_theone_env
  unset XDG_RUNTIME_DIR
  WS="${BATS_TEST_TMPDIR}/workspace"
  AGENT="${WS}/.agent"
  export THEONE_WORKSPACE="${WS}"
  DEV_UID="$(id -u dev)"
  rm -rf "${DEV_HOME}/.vnc" "${DEV_HOME}/.claude" /run/theone /run/supervisor /etc/theone-victim*
  TOOLS=/tmp/theone-test-tools
  rm -rf "${TOOLS}"
}

teardown() {
  rm -rf /etc/theone-victim* "${TOOLS:-/nonexistent}"
  if [[ -e /usr/bin/supervisord.theone-test ]]; then
    mv -f /usr/bin/supervisord.theone-test /usr/bin/supervisord
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
  install -d -o root -g root -m 0755 /etc/theone-victim-dir
  echo root-data > /etc/theone-victim-dir/keep
}

victim_file() {
  printf 'rootsecret\n' > /etc/theone-victim-file
  chown root:root /etc/theone-victim-file
  chmod 0600 /etc/theone-victim-file
}

@test "creates the workspace layout owned by dev" {
  entrypoint
  assert_success
  local dir
  for dir in "${WS}" "${WS}/projects" "${WS}/artifacts" "${AGENT}" "${AGENT}/projects" "${AGENT}/logs" "${AGENT}/logs/supervisor"; do
    assert_equal "$(owner_mode "${dir}")" "dev:dev 755"
  done
  assert_equal "$(owner_mode "${AGENT}/controller")" "dev:dev 700"
  assert_equal "$(owner_mode "${DEV_HOME}/.claude")" "dev:dev 700"
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
  before="$(find "${WS}" "${DEV_HOME}/.vnc" "${DEV_HOME}/.claude" ! -name ENVIRONMENT.md ! -name DECISIONS.md -printf '%p %u %g %m\n' | sort)"

  entrypoint
  assert_success
  assert_output --partial "seeded 1 agent memory file(s)"
  assert_equal "$(cat "${AGENT}/GLOBAL_CONTEXT.md")" "my notes"
  assert_file_exists "${AGENT}/DECISIONS.md"
  assert_equal "$(find "${WS}" "${DEV_HOME}/.vnc" "${DEV_HOME}/.claude" ! -name ENVIRONMENT.md ! -name DECISIONS.md -printf '%p %u %g %m\n' | sort)" "${before}"

  entrypoint
  refute_output --partial "seeded"
  refute_output --partial "generated a VNC password"
  refute_output --partial "fixing ownership"
}

@test "installs SPEC.md as ~/.claude/CLAUDE.md once" {
  [[ -r /etc/theone/SPEC.md ]] || skip "no /etc/theone/SPEC.md"
  entrypoint
  assert_output --partial "installed /etc/theone/SPEC.md as ${DEV_HOME}/.claude/CLAUDE.md"
  cmp -s /etc/theone/SPEC.md "${DEV_HOME}/.claude/CLAUDE.md"
  assert_equal "$(owner_mode "${DEV_HOME}/.claude/CLAUDE.md")" "dev:dev 644"

  echo custom > "${DEV_HOME}/.claude/CLAUDE.md"
  entrypoint
  refute_output --partial "installed"
  assert_equal "$(cat "${DEV_HOME}/.claude/CLAUDE.md")" "custom"
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
  assert_equal "$(grep '^THEONE_VNC_PASSWORD=' /run/theone/controller.env)" "THEONE_VNC_PASSWORD=${password}"
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

@test "THEONE_VNC_PASSWORD wins over the stored password and warns beyond 8 characters" {
  THEONE_VNC_PASSWORD=short1 entrypoint
  refute_output --partial "generated a VNC password"
  refute_output --partial "first 8 characters"
  assert_file_not_exists "${DEV_HOME}/.vnc/password"
  assert_equal "$(cat /run/theone/controller.env)" "THEONE_VNC_PASSWORD=short1"

  THEONE_VNC_PASSWORD=muchlongerpassword entrypoint
  assert_output --partial "VNC authentication only uses the first 8 characters of the password"
}

@test "controller.env is dev-only, root keeps its directory, secrets round-trip" {
  local password=$'p a$s\'"`x' token='tok;en $(touch /tmp/theone-pwned)'
  THEONE_VNC_PASSWORD="${password}" THEONE_TOKEN="${token}" entrypoint
  assert_success
  assert_equal "$(owner_mode /run/theone)" "root:root 755"
  assert_equal "$(owner_mode /run/theone/controller.env)" "dev:dev 600"
  run bash -c 'set -a; . /run/theone/controller.env; printf "%s\n%s" "${THEONE_VNC_PASSWORD}" "${THEONE_TOKEN}"'
  assert_output "${password}
${token}"
  assert_file_not_exists /tmp/theone-pwned
}

@test "THEONE_TOKEN only reaches controller.env when set" {
  entrypoint
  run grep -c THEONE_TOKEN /run/theone/controller.env
  assert_output 0
}

@test "empty THEONE_, ANTHROPIC_, CLAUDE_ and DOCKER_ variables are dropped" {
  run env THEONE_EMPTY= ANTHROPIC_API_KEY= CLAUDE_CODE_OAUTH_TOKEN= DOCKER_HOST= KEEP_EMPTY= THEONE_SET=v \
    "${ENTRYPOINT}" env
  assert_success
  refute_line "THEONE_EMPTY="
  refute_line "ANTHROPIC_API_KEY="
  refute_line "CLAUDE_CODE_OAUTH_TOKEN="
  refute_line "DOCKER_HOST="
  assert_line "KEEP_EMPTY="
  assert_line "THEONE_SET=v"
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
    mv /usr/bin/supervisord /usr/bin/supervisord.theone-test
  fi
  SUPERVISORD_STUBBED=1
  cat > /usr/bin/supervisord << 'EOF'
#!/bin/sh
echo "supervisord $*"
echo "token=${THEONE_TOKEN-unset} password=${THEONE_VNC_PASSWORD-unset} other=${THEONE_SANDBOX_ID-unset}"
EOF
  chmod +x /usr/bin/supervisord
  THEONE_TOKEN=secret-token THEONE_VNC_PASSWORD=secretpw THEONE_SANDBOX_ID=box run "${ENTRYPOINT}"
  assert_success
  assert_line "supervisord -n -c /etc/supervisor/supervisord.conf"
  assert_line "token=unset password=unset other=box"
  assert_equal "$(cat /run/theone/controller.env)" "THEONE_VNC_PASSWORD=secretpw
THEONE_TOKEN=secret-token"
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
  ln -s /etc/theone-victim-file "${WS}/projects/link"
  install -d -o root -g root "${WS}/.agent/logs/supervisor"
  ln -s /etc/theone-victim-file "${WS}/.agent/logs/supervisor/supervisord.log"
  entrypoint
  assert_success
  assert_equal "$(owner_mode /etc/theone-victim-file)" "root:root 600"
  assert_equal "$(stat -c %U "${WS}/projects")" dev
}

@test "symlinked directories in the volumes are replaced, never followed" {
  victim_dir
  install -d -o dev -g dev "${AGENT}" "${AGENT}/projects"
  chown dev:dev "${WS}"
  ln -s /etc/theone-victim-dir "${AGENT}/logs"
  ln -s /etc/theone-victim-dir "${AGENT}/controller"
  ln -s /etc/theone-victim-dir "${AGENT}/projects/_template"
  ln -s /etc/theone-victim-dir "${DEV_HOME}/.claude"
  ln -s /etc/theone-victim-dir "${DEV_HOME}/.vnc"
  entrypoint
  assert_success
  local dir
  for dir in "${AGENT}/logs" "${AGENT}/controller" "${AGENT}/projects/_template" "${DEV_HOME}/.claude" "${DEV_HOME}/.vnc"; do
    assert_not_symlink_to /etc/theone-victim-dir "${dir}"
    assert_dir_exists "${dir}"
    [[ ! -L "${dir}" ]]
  done
  assert_equal "$(owner_mode /etc/theone-victim-dir)" "root:root 755"
  assert_equal "$(ls -A /etc/theone-victim-dir)" "keep"
}

@test "a symlinked password file is neither read nor written through" {
  victim_file
  install -d -o dev -g dev -m 0700 "${DEV_HOME}/.vnc"
  ln -s /etc/theone-victim-file "${DEV_HOME}/.vnc/password"
  ln -s /etc/theone-victim-file "${DEV_HOME}/.vnc/passwd"
  entrypoint
  assert_success
  [[ ! -L "${DEV_HOME}/.vnc/password" ]]
  refute [ "$(cat "${DEV_HOME}/.vnc/password")" = rootsecret ]
  run grep -c rootsecret /run/theone/controller.env
  assert_output 0
  assert_equal "$(cat /etc/theone-victim-file)" "rootsecret"
  assert_equal "$(owner_mode /etc/theone-victim-file)" "root:root 600"
}

@test "dangling symlinks planted for seeded files are not written through" {
  install -d -o dev -g dev "${AGENT}"
  chown dev:dev "${WS}"
  ln -s /etc/theone-victim-planted "${AGENT}/GLOBAL_CONTEXT.md"
  install -d -o dev -g dev -m 0700 "${DEV_HOME}/.claude"
  ln -s /etc/theone-victim-claude "${DEV_HOME}/.claude/CLAUDE.md"
  entrypoint
  assert_success
  assert_file_not_exists /etc/theone-victim-planted
  assert_file_not_exists /etc/theone-victim-claude
  [[ ! -L "${AGENT}/GLOBAL_CONTEXT.md" ]]
  assert_equal "$(stat -c %U "${AGENT}/GLOBAL_CONTEXT.md")" dev
}

@test "a symlinked ENVIRONMENT.md is replaced, never written through" {
  victim_file
  install -d -o dev -g dev "${AGENT}"
  chown dev:dev "${WS}"
  ln -s /etc/theone-victim-file "${AGENT}/ENVIRONMENT.md"
  entrypoint
  assert_success
  [[ ! -L "${AGENT}/ENVIRONMENT.md" ]]
  assert_equal "$(cat /etc/theone-victim-file)" "rootsecret"
}

@test "removes the stale X lock and socket of the configured display" {
  mkdir -p /tmp/.X11-unix
  touch /tmp/.X7-lock /tmp/.X11-unix/X7 /tmp/.X8-lock
  THEONE_DISPLAY=:7.0 entrypoint
  assert_success
  assert_file_not_exists /tmp/.X7-lock
  assert_file_not_exists /tmp/.X11-unix/X7
  assert_file_exists /tmp/.X8-lock
  rm -f /tmp/.X8-lock
}

@test "ENVIRONMENT.md is regenerated on every start, dev-owned and read-only for others" {
  THEONE_SANDBOX_ID=first entrypoint
  assert_equal "$(owner_mode "${AGENT}/ENVIRONMENT.md")" "dev:dev 644"
  assert_file_contains "${AGENT}/ENVIRONMENT.md" '^| Sandbox id | first |$'

  THEONE_SANDBOX_ID=second DOCKER_HOST=tcp://docker:2376 THEONE_PUBLIC_URL=https://x.ts.net THEONE_PORT=7711 entrypoint
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
  assert_line "[theone-entrypoint] could not write ${AGENT}/ENVIRONMENT.md"
  assert_line "started"
  run find "${AGENT}" -maxdepth 1 -name '.ENVIRONMENT.md.*'
  assert_output ""
}
