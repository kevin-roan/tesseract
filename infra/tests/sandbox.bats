#!/usr/bin/env bats
# infra/scripts/sandbox against a stub docker. The script runs through a symlink inside a
# temporary repo layout, so the real infra/compose/.env is never read.

load lib/common

setup() {
  unset_tesseract_env
  setup_stubs
  FAKE_REPO="${BATS_TEST_TMPDIR}/repo"
  COMPOSE="${FAKE_REPO}/infra/compose"
  mkdir -p "${FAKE_REPO}/infra/scripts" "${COMPOSE}" "${FAKE_REPO}/infra/docker/sandbox"
  FAKE_REPO="$(cd -- "${FAKE_REPO}" && pwd -P)"
  COMPOSE="${FAKE_REPO}/infra/compose"
  SANDBOX="${FAKE_REPO}/infra/scripts/sandbox"
  ln -s "${REPO}/infra/scripts/sandbox" "${SANDBOX}"
  ENV_LOG="${BATS_TEST_TMPDIR}/env.log"
  export ENV_LOG
  # The legacy (theone) stack migration has its own tests below, with their own stub.
  export TESSERACT_SKIP_LEGACY_MIGRATION=1
  stub docker '
case "$*" in
  *" ps --status running --quiet sandbox") [[ -z "${STUB_RUNNING:-}" ]] || echo 0123abcd ;;
  "volume inspect "*) [[ -n "${STUB_VOLUME_EXISTS:-}" ]] || exit 1 ;;
esac
printf "%s|%s|%s|%s|%s\n" "${TESSERACT_BIND_ADDR-unset}" "${TESSERACT_COMPOSE_PROJECT-unset}" \
  "${TESSERACT_VOLUME_PREFIX-unset}" "${TESSERACT_CONTROLLER_HOST_PORT-unset}" "${TESSERACT_VNC_HOST_PORT-unset}" >> "${ENV_LOG}"
exit "${STUB_DOCKER_STATUS:-0}"'
}

write_env() {
  printf '%s\n' "$@" > "${COMPOSE}/.env"
}

compose_prefix() {
  local project=${1:-tesseract} overlay
  printf 'compose --project-name %s --project-directory %s -f %s/compose.yml' "${project}" "${COMPOSE}" "${COMPOSE}"
  shift || true
  for overlay in "$@"; do
    printf ' -f %s/compose.%s.yml' "${COMPOSE}" "${overlay}"
  done
}

last_env() {
  tail -n 1 "${ENV_LOG}"
}

@test "help, -h, --help and no command print the usage without touching docker" {
  local args
  for args in help -h --help ""; do
    run env PATH="$(minimal_path)" "${SANDBOX}" ${args}
    assert_success
    assert_output --partial "Usage: sandbox [--mode tailscale|host-tailscale|local]"
  done
  assert_equal "$(calls)" ""
}

@test "global options before help are still accepted" {
  run "${SANDBOX}" --mode local --dind help
  assert_success
  assert_output --partial "Commands:"
}

@test "an unknown command prints the usage and fails" {
  run "${SANDBOX}" --mode local frobnicate
  assert_failure 1
  assert_output --partial "Usage: sandbox"
  assert_output --partial "sandbox: unknown command 'frobnicate'"
  assert_equal "$(calls)" ""
}

@test "fails when docker is not installed" {
  rm "${STUB_BIN}/docker"
  run env PATH="$(minimal_path)" "${SANDBOX}" --mode local ps
  assert_failure 1
  assert_output "sandbox: docker is not installed"
}

@test "defaults to tailscale mode with project tesseract" {
  run "${SANDBOX}" ps
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract tailscale) ps"
  assert_equal "$(last_env)" "unset|tesseract|tesseract|7700|5901"
}

@test "local mode uses compose.local.yml bound to 127.0.0.1" {
  run "${SANDBOX}" --mode local ps -a
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract local) ps -a"
  assert_equal "$(last_env)" "127.0.0.1|tesseract|tesseract|7700|5901"
}

@test "local mode ignores TESSERACT_BIND_ADDR from the env file and the environment" {
  write_env TESSERACT_BIND_ADDR=0.0.0.0
  TESSERACT_BIND_ADDR=0.0.0.0 run "${SANDBOX}" --mode local ps
  assert_success
  assert_equal "$(last_env)" "127.0.0.1|tesseract|tesseract|7700|5901"
}

@test "--mode=VALUE and options after the command are accepted" {
  run "${SANDBOX}" ps --mode=local --dind
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract local dind) ps"
}

@test "--mode without a value fails" {
  run "${SANDBOX}" ps --mode
  assert_failure 1
  assert_output "sandbox: --mode needs a value"
}

@test "an unknown mode fails" {
  run "${SANDBOX}" --mode lan ps
  assert_failure 1
  assert_output "sandbox: unknown mode 'lan' (tailscale, host-tailscale or local)"
  assert_equal "$(calls)" ""
}

@test "mode precedence: --mode, then TESSERACT_MODE, then the env file, then tailscale" {
  write_env TESSERACT_MODE=host-tailscale TESSERACT_BIND_ADDR=100.64.0.7
  TESSERACT_MODE=local run "${SANDBOX}" --mode tailscale ps
  assert_equal "$(calls_of docker | tail -n 1)" "$(compose_prefix tesseract tailscale) ps"

  TESSERACT_MODE=local run "${SANDBOX}" ps
  assert_equal "$(calls_of docker | tail -n 1)" "$(compose_prefix tesseract local) ps"

  run "${SANDBOX}" ps
  assert_equal "$(calls_of docker | tail -n 1)" "$(compose_prefix tesseract local) ps"
  assert_equal "$(last_env)" "100.64.0.7|tesseract|tesseract|7700|5901"
}

@test "an empty exported variable falls back to the env file" {
  write_env TESSERACT_MODE=local
  TESSERACT_MODE="" run "${SANDBOX}" ps
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract local) ps"
}

@test "arguments after -- are passed through and never parsed as options" {
  run "${SANDBOX}" --mode local logs -- --mode lan --dind
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract local) logs --tail=200 -- --mode lan --dind"
}

@test "--dind and TESSERACT_DIND=1|true|yes add compose.dind.yml" {
  local value
  for value in 1 true yes; do
    : > "${STUB_LOG}"
    write_env TESSERACT_MODE=local "TESSERACT_DIND=${value}"
    run "${SANDBOX}" ps
    assert_success
    assert_equal "$(calls_of docker)" "$(compose_prefix tesseract local dind) ps"
  done
}

@test "TESSERACT_DIND=0|no|false|empty leaves dind out" {
  local value
  for value in 0 no false ""; do
    : > "${STUB_LOG}"
    write_env TESSERACT_MODE=local "TESSERACT_DIND=${value}"
    run "${SANDBOX}" ps
    assert_success
    assert_equal "$(calls_of docker)" "$(compose_prefix tesseract local) ps"
  done
}

@test "--tailscale-api and TESSERACT_TAILSCALE_LOCALAPI pick the overlay for the mode" {
  run "${SANDBOX}" --mode local --tailscale-api ps
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract local tailscale-api) ps"
  : > "${STUB_LOG}"
  write_env TESSERACT_TAILSCALE_LOCALAPI=1
  run "${SANDBOX}" ps
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract tailscale tailscale-api-sidecar) ps"
  : > "${STUB_LOG}"
  write_env TESSERACT_MODE=local TESSERACT_TAILSCALE_LOCALAPI=0
  run "${SANDBOX}" ps
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract local) ps"
}

@test "--tailscale-api up needs the host socket and warns about the trade-off" {
  local dir="${BATS_TEST_TMPDIR}/tsrun"
  mkdir -p "${dir}"
  write_env TESSERACT_MODE=local "TESSERACT_TAILSCALE_HOST_SOCKET_DIR=${dir}"
  run "${SANDBOX}" --tailscale-api up
  assert_failure 1
  assert_output --partial "no tailscaled socket at ${dir}/tailscaled.sock"
  assert_equal "$(calls_of docker)" ""
  python3 -c 'import socket,sys; socket.socket(socket.AF_UNIX).bind(sys.argv[1])' "${dir}/tailscaled.sock"
  run "${SANDBOX}" --tailscale-api up
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract local tailscale-api) up --detach"
  assert_output --partial "tailscale LocalAPI shared with the sandbox"
  write_env TESSERACT_MODE=local TESSERACT_TAILSCALE_HOST_SOCKET_DIR=relative
  run "${SANDBOX}" --tailscale-api ps
  assert_failure 1
  assert_output --partial "must be an absolute path"
}

@test "TESSERACT_HOST_ANDROID_SDK and TESSERACT_HOST_GRADLE_CACHE add their overlays" {
  write_env TESSERACT_MODE=local TESSERACT_HOST_ANDROID_SDK=/srv/sdk
  run "${SANDBOX}" ps
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract local host-android-sdk) ps"
  : > "${STUB_LOG}"
  write_env TESSERACT_MODE=local TESSERACT_HOST_ANDROID_SDK=/srv/sdk TESSERACT_HOST_GRADLE_CACHE=/srv/gradle/caches
  run "${SANDBOX}" ps
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract local host-android-sdk host-gradle-cache) ps"
  write_env TESSERACT_MODE=local TESSERACT_HOST_GRADLE_CACHE=caches
  run "${SANDBOX}" ps
  assert_failure 1
  assert_output --partial "TESSERACT_HOST_GRADLE_CACHE=caches must be an absolute path"
}

@test "up with a host SDK or Gradle cache checks them on a Linux x86_64 host" {
  local sdk="${BATS_TEST_TMPDIR}/sdk" cache="${BATS_TEST_TMPDIR}/caches"
  stub uname 'case "$1" in -s) echo "${STUB_UNAME_S:-Linux}" ;; -m) echo x86_64 ;; esac'
  mkdir -p "${sdk}" "${cache}"
  write_env TESSERACT_MODE=local "TESSERACT_HOST_ANDROID_SDK=${sdk}" "TESSERACT_HOST_GRADLE_CACHE=${cache}"
  run "${SANDBOX}" up
  assert_failure 1
  assert_output --partial "is not an Android SDK"
  mkdir -p "${sdk}/platform-tools" "${sdk}/platforms"
  run "${SANDBOX}" up
  assert_failure 1
  assert_output --partial "has no modules-2/"
  mkdir -p "${cache}/modules-2"
  STUB_UNAME_S=Darwin run "${SANDBOX}" up
  assert_failure 1
  assert_output --partial "needs a Linux x86_64 host"
  assert_equal "$(calls_of docker)" ""
  run "${SANDBOX}" up
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract local host-android-sdk host-gradle-cache) up --detach"
}

@test "--env-file is passed to compose and replaces infra/compose/.env" {
  write_env TESSERACT_MODE=tailscale TESSERACT_COMPOSE_PROJECT=wrong
  printf 'TESSERACT_MODE=local\nTESSERACT_COMPOSE_PROJECT=tesseract-alt\n' > "${BATS_TEST_TMPDIR}/alt.env"
  run "${SANDBOX}" --env-file "${BATS_TEST_TMPDIR}/alt.env" ps
  assert_success
  assert_equal "$(calls_of docker)" \
    "compose --project-name tesseract-alt --project-directory ${COMPOSE} --env-file ${BATS_TEST_TMPDIR}/alt.env -f ${COMPOSE}/compose.yml -f ${COMPOSE}/compose.local.yml ps"
}

@test "a relative --env-file=PATH is resolved against the working directory" {
  printf 'TESSERACT_MODE=local\n' > "${BATS_TEST_TMPDIR}/rel.env"
  cd "${BATS_TEST_TMPDIR}"
  run "${SANDBOX}" ps --env-file=rel.env
  assert_success
  assert_equal "$(calls_of docker)" \
    "compose --project-name tesseract --project-directory ${COMPOSE} --env-file ${BATS_TEST_TMPDIR}/rel.env -f ${COMPOSE}/compose.yml -f ${COMPOSE}/compose.local.yml ps"
}

@test "--env-file without a path, with an empty path or a missing file fails" {
  run "${SANDBOX}" ps --env-file
  assert_failure 1
  assert_output "sandbox: --env-file needs a path"

  run "${SANDBOX}" --env-file= ps
  assert_failure 1
  assert_output "sandbox: --env-file needs a path"

  run "${SANDBOX}" --env-file "${BATS_TEST_TMPDIR}/missing.env" ps
  assert_failure 1
  assert_output "sandbox: env file not found: ${BATS_TEST_TMPDIR}/missing.env"

  run "${SANDBOX}" --env-file "${BATS_TEST_TMPDIR}" ps
  assert_failure 1
  assert_output --partial "env file not found"
  assert_equal "$(calls)" ""
}

@test "env file parsing follows compose's quoting and comment rules" {
  write_env \
    '# TESSERACT_COMPOSE_PROJECT=commented' \
    '  export TESSERACT_COMPOSE_PROJECT="quoted-project" # trailing' \
    "TESSERACT_VOLUME_PREFIX='single.quoted'" \
    'TESSERACT_CONTROLLER_HOST_PORT=17700 # comment' \
    'TESSERACT_VNC_HOST_PORT=15901   ' \
    'TESSERACT_MODE_EXTRA=tailscale' \
    'TESSERACT_MODE=local'
  run "${SANDBOX}" ps
  assert_success
  assert_equal "$(last_env)" "127.0.0.1|quoted-project|single.quoted|17700|15901"
}

@test "env file: the last assignment wins and a value may contain = and #" {
  write_env TESSERACT_MODE=tailscale TESSERACT_MODE=local 'TESSERACT_BIND_ADDR=x' \
    'TS_TAILNET_DOMAIN=a=b#c' 'TESSERACT_HOSTNAME=host#1'
  run "${SANDBOX}" --mode tailscale up
  assert_failure
  assert_output --partial "TS_AUTHKEY is required"

  printf 'TS_AUTHKEY=tskey\n' >> "${COMPOSE}/.env"
  run "${SANDBOX}" --mode tailscale up
  assert_success
  assert_output --partial "controller: https://host#1.a=b#c  VNC: host#1:5901"
}

@test "env file: CRLF line endings and a missing final newline are handled" {
  printf 'TESSERACT_COMPOSE_PROJECT=crlf\r\nTESSERACT_MODE=local' > "${COMPOSE}/.env"
  run "${SANDBOX}" ps
  assert_success
  assert_equal "$(last_env)" "127.0.0.1|crlf|crlf|7700|5901"
}

@test "exported variables win over the env file" {
  write_env TESSERACT_MODE=local TESSERACT_COMPOSE_PROJECT=from-file TESSERACT_CONTROLLER_HOST_PORT=1111
  TESSERACT_COMPOSE_PROJECT=from-env TESSERACT_VOLUME_PREFIX=vols run "${SANDBOX}" ps
  assert_success
  assert_equal "$(last_env)" "127.0.0.1|from-env|vols|1111|5901"
}

@test "rejects invalid compose project names" {
  local name
  for name in Tesseract -tesseract "the one" "../x" "a/b"; do
    TESSERACT_COMPOSE_PROJECT="${name}" run "${SANDBOX}" --mode local ps
    assert_failure 1
    assert_output --partial "TESSERACT_COMPOSE_PROJECT=${name} is not a valid compose project name"
  done
  assert_equal "$(calls)" ""
}

@test "rejects invalid volume prefixes" {
  local prefix
  for prefix in .hidden "a b" "a/b" "-x"; do
    TESSERACT_VOLUME_PREFIX="${prefix}" run "${SANDBOX}" --mode local ps
    assert_failure 1
    assert_output --partial "TESSERACT_VOLUME_PREFIX=${prefix} is not a valid volume name prefix"
  done
}

@test "accepts ports 1 and 65535" {
  TESSERACT_CONTROLLER_HOST_PORT=1 TESSERACT_VNC_HOST_PORT=65535 run "${SANDBOX}" --mode local ps
  assert_success
  assert_equal "$(last_env)" "127.0.0.1|tesseract|tesseract|1|65535"
}

@test "rejects host ports that are not TCP ports" {
  local port
  for port in 0 65536 99999 080 abc 77.0 " 7700" -1 123456; do
    TESSERACT_CONTROLLER_HOST_PORT="${port}" run "${SANDBOX}" --mode local ps
    assert_failure 1
    assert_output "sandbox: TESSERACT_CONTROLLER_HOST_PORT=${port} is not a TCP port"
    TESSERACT_VNC_HOST_PORT="${port}" run "${SANDBOX}" --mode local ps
    assert_failure 1
    assert_output "sandbox: TESSERACT_VNC_HOST_PORT=${port} is not a TCP port"
  done
  assert_equal "$(calls)" ""
}

@test "host-tailscale uses TESSERACT_BIND_ADDR over tailscale ip -4" {
  stub tailscale 'echo 100.100.100.100'
  TESSERACT_BIND_ADDR=100.64.0.9 run "${SANDBOX}" --mode host-tailscale up
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract local) up --detach"
  assert_equal "$(last_env)" "100.64.0.9|tesseract|tesseract|7700|5901"
  assert_equal "$(calls_of tailscale)" ""
  assert_output --partial "controller: http://100.64.0.9:7700  VNC: 100.64.0.9:5901"
}

@test "host-tailscale takes the first address of tailscale ip -4" {
  stub tailscale 'printf "100.101.102.103\n100.64.0.1\n"'
  run "${SANDBOX}" --mode host-tailscale up
  assert_success
  assert_equal "$(calls_of tailscale)" "ip -4"
  assert_equal "$(last_env)" "100.101.102.103|tesseract|tesseract|7700|5901"
}

@test "host-tailscale: up and config fail without an address, other commands fall back to loopback" {
  stub tailscale 'exit 1'
  local command
  for command in up config; do
    run "${SANDBOX}" --mode host-tailscale "${command}"
    assert_failure 1
    assert_output --partial "could not determine the host tailscale IPv4"
  done
  assert_equal "$(calls_of docker)" ""

  rm "${STUB_BIN}/tailscale"
  run env PATH="$(minimal_path)" "${SANDBOX}" --mode host-tailscale down
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract local) down --remove-orphans"
  assert_equal "$(last_env)" "127.0.0.1|tesseract|tesseract|7700|5901"
}

@test "host-tailscale refuses wildcard bind addresses" {
  local addr
  for addr in 0.0.0.0 :: "[::]" "*"; do
    TESSERACT_BIND_ADDR="${addr}" run "${SANDBOX}" --mode host-tailscale down
    assert_failure 1
    assert_output --partial "would publish the sandbox on every host interface"
  done
  assert_equal "$(calls)" ""
}

@test "host-tailscale refuses a wildcard address coming from the env file" {
  write_env TESSERACT_MODE=host-tailscale 'TESSERACT_BIND_ADDR="0.0.0.0"'
  run "${SANDBOX}" up
  assert_failure 1
  assert_output --partial "TESSERACT_BIND_ADDR=0.0.0.0 would publish the sandbox on every host interface"
  assert_equal "$(calls)" ""
}

@test "host-tailscale refuses other spellings of the wildcard address" {
  local addr
  for addr in "[::0]" "::0" "[0:0:0:0:0:0:0:0]" 0 0.0.0.1 " 0.0.0.0" "0.0.0.0 " "[::ffff:0.0.0.0]"; do
    TESSERACT_BIND_ADDR="${addr}" run "${SANDBOX}" --mode host-tailscale up
    assert_failure 1
    assert_output --partial "TESSERACT_BIND_ADDR="
  done
  assert_equal "$(calls)" ""
}

@test "host-tailscale refuses bind addresses that are not IPv4 literals" {
  local addr
  for addr in localhost my.host 100.64.0 100.64.0.1.2 256.1.1.1 "100.64.0.1:80" "100.64.0.1 -p" "[fd7a:115c:a1e0::1]"; do
    TESSERACT_BIND_ADDR="${addr}" run "${SANDBOX}" --mode host-tailscale up
    assert_failure 1
    assert_output --partial "is not an IPv4 address"
  done
  assert_equal "$(calls)" ""
}

@test "host-tailscale accepts a loopback or private IPv4" {
  local addr
  for addr in 127.0.0.1 100.64.0.1 192.168.1.20 10.0.0.255; do
    TESSERACT_BIND_ADDR="${addr}" run "${SANDBOX}" --mode host-tailscale up
    assert_success
    assert_equal "$(last_env)" "${addr}|tesseract|tesseract|7700|5901"
  done
}

@test "tailscale up requires TS_TAILNET_DOMAIN" {
  TS_AUTHKEY=tskey run "${SANDBOX}" up
  assert_failure 1
  assert_output --partial "TS_TAILNET_DOMAIN is required in tailscale mode"
  assert_equal "$(calls)" ""
}

@test "tailscale up requires TS_AUTHKEY while the state volume does not exist" {
  write_env TS_TAILNET_DOMAIN=tail1234.ts.net TESSERACT_VOLUME_PREFIX=pfx
  run "${SANDBOX}" up
  assert_failure 1
  assert_output --partial "TS_AUTHKEY is required for the first start"
  assert_equal "$(calls_of docker)" "volume inspect pfx-tailscale"
}

@test "tailscale up without TS_AUTHKEY works once the state volume exists" {
  write_env TS_TAILNET_DOMAIN=tail1234.ts.net
  STUB_VOLUME_EXISTS=1 run "${SANDBOX}" up
  assert_success
  assert_equal "$(calls_of docker)" "volume inspect tesseract-tailscale
$(compose_prefix tesseract tailscale) up --detach"
  assert_output --partial "controller: https://tesseract-sandbox.tail1234.ts.net  VNC: tesseract-sandbox:5901"
  assert_output --partial "pair the mobile app with: sandbox pair"
}

@test "tailscale up with TS_AUTHKEY skips the volume check and passes compose arguments" {
  write_env TS_TAILNET_DOMAIN=tail1234.ts.net TS_AUTHKEY=tskey-auth-x TESSERACT_HOSTNAME=box
  run "${SANDBOX}" up --build --dind
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract tailscale dind) up --detach --build"
  assert_output --partial "controller: https://box.tail1234.ts.net  VNC: box:5901"
}

@test "tailscale mode commands other than up need no tailnet configuration" {
  run "${SANDBOX}" logs -f
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract tailscale) logs --tail=200 -f"
}

@test "up in local mode reports the custom host ports" {
  write_env TESSERACT_MODE=local TESSERACT_CONTROLLER_HOST_PORT=17700 TESSERACT_VNC_HOST_PORT=15901
  run "${SANDBOX}" up
  assert_success
  assert_output --partial "controller: http://127.0.0.1:17700  VNC: 127.0.0.1:15901"
}

@test "a failing compose up fails the command without printing the URLs" {
  STUB_DOCKER_STATUS=3 run "${SANDBOX}" --mode local up
  assert_failure 3
  refute_output --partial "controller:"
}

@test "down, restart, ps and config map onto compose" {
  run "${SANDBOX}" --mode local down -v
  run "${SANDBOX}" --mode local restart controller
  run "${SANDBOX}" --mode local config --quiet
  local prefix
  prefix="$(compose_prefix tesseract local)"
  assert_equal "$(calls_of docker)" "${prefix} down --remove-orphans -v
${prefix} restart controller
${prefix} config --quiet"
}

@test "shell, pair and doctor refuse to run while the sandbox is stopped" {
  local command
  for command in shell pair doctor; do
    : > "${STUB_LOG}"
    run "${SANDBOX}" --mode local "${command}"
    assert_failure 1
    assert_output "sandbox: the sandbox is not running (start it with: sandbox up)"
    assert_equal "$(calls_of docker)" "$(compose_prefix tesseract local) ps --status running --quiet sandbox"
  done
}

@test "shell opens a login shell as dev in /workspace" {
  STUB_RUNNING=1 run "${SANDBOX}" --mode local shell
  assert_success
  assert_equal "$(calls_of docker | tail -n 1)" "$(compose_prefix tesseract local) exec -u dev -w /workspace sandbox bash -l"
}

@test "pair and doctor pass their arguments to the tools inside the sandbox" {
  STUB_RUNNING=1 run "${SANDBOX}" --mode local pair --json
  assert_success
  STUB_RUNNING=1 run "${SANDBOX}" --mode local doctor
  assert_success
  local prefix
  prefix="$(compose_prefix tesseract local)"
  assert_equal "$(calls_of docker | grep ' exec ')" "${prefix} exec -u dev sandbox tesseract-controller pair --json
${prefix} exec -u dev sandbox tesseract-doctor"
}

@test "status only queries the controller while the sandbox runs" {
  local prefix
  prefix="$(compose_prefix tesseract local)"
  run "${SANDBOX}" --mode local status
  assert_success
  assert_equal "$(calls_of docker)" "${prefix} ps
${prefix} ps --status running --quiet sandbox"

  : > "${STUB_LOG}"
  STUB_RUNNING=1 run "${SANDBOX}" --mode local status
  assert_success
  assert_equal "$(calls_of docker)" "${prefix} ps
${prefix} ps --status running --quiet sandbox
${prefix} exec -T -u dev sandbox tesseract-controller status"
}

@test "build without a target builds the sandbox service through compose" {
  run "${SANDBOX}" --mode local build --no-cache --pull
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract local) build --no-cache --pull sandbox"

  : > "${STUB_LOG}"
  run "${SANDBOX}" --mode local build --target sandbox
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract local) build sandbox"
}

@test "build --target <stage> tags tesseract/sandbox:<stage> with docker build" {
  run "${SANDBOX}" --mode local build --target electron --progress=plain
  assert_success
  assert_equal "$(calls_of docker)" \
    "build -f ${FAKE_REPO}/infra/docker/sandbox/Dockerfile --target electron -t tesseract/sandbox:electron --progress=plain ${FAKE_REPO}"

  : > "${STUB_LOG}"
  run "${SANDBOX}" --mode local build --target=base
  assert_equal "$(calls_of docker)" \
    "build -f ${FAKE_REPO}/infra/docker/sandbox/Dockerfile --target base -t tesseract/sandbox:base ${FAKE_REPO}"
}

@test "build --target without a stage fails" {
  run "${SANDBOX}" --mode local build --target
  assert_failure 1
  assert_output "sandbox: --target needs a stage name"
  assert_equal "$(calls)" ""
}

@test "custom project and volume prefix reach compose and the tailscale volume check" {
  write_env TESSERACT_COMPOSE_PROJECT=tesseract-two TESSERACT_VOLUME_PREFIX=two TS_TAILNET_DOMAIN=t.ts.net
  STUB_VOLUME_EXISTS=1 run "${SANDBOX}" up
  assert_success
  assert_equal "$(calls_of docker)" "volume inspect two-tailscale
$(compose_prefix tesseract-two tailscale) up --detach"
  assert_equal "$(last_env)" "unset|tesseract-two|two|7700|5901"
}

claude_home() {
  CLAUDE_HOME="${BATS_TEST_TMPDIR}/home"
  STATE="${BATS_TEST_TMPDIR}/state"
  OVERRIDE="${STATE}/tesseract/compose.tesseract.claude-accounts.yml"
  mkdir -p "${CLAUDE_HOME}"
}

claude_sandbox() {
  HOME="${CLAUDE_HOME}" XDG_STATE_HOME="${STATE}" run "${SANDBOX}" "$@"
}

@test "claude accounts: none configured adds no override and writes nothing" {
  claude_home
  mkdir "${CLAUDE_HOME}/.claude-work"
  claude_sandbox --mode local ps
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract local) ps"
  assert_file_not_exists "${STATE}/tesseract"
}

@test "claude accounts: each existing ~/.claude-<name> is bind-mounted through an override for every command" {
  claude_home
  mkdir "${CLAUDE_HOME}/.claude-work" "${CLAUDE_HOME}/.claude-personal"
  write_env 'TESSERACT_HOST_CLAUDE_ACCOUNTS="work, personal"'
  claude_sandbox --mode local ps
  claude_sandbox --mode local down -v
  claude_sandbox --mode local logs -f
  claude_sandbox --mode local config --quiet
  assert_success
  local prefix
  prefix="$(compose_prefix tesseract local) -f ${OVERRIDE}"
  assert_equal "$(calls_of docker)" "${prefix} ps
${prefix} down --remove-orphans -v
${prefix} logs --tail=200 -f
${prefix} config --quiet"
  assert_equal "$(cat "${OVERRIDE}")" 'services:
  sandbox:
    environment:
      TESSERACT_CLAUDE_ACCOUNTS: "work,personal"
    volumes:
      - type: bind
        source: "'"${CLAUDE_HOME}"'/.claude-work"
        target: "/home/dev/.claude-work"
        bind:
          create_host_path: false
      - type: bind
        source: "'"${CLAUDE_HOME}"'/.claude-personal"
        target: "/home/dev/.claude-personal"
        bind:
          create_host_path: false'
  assert_equal "$(find "${STATE}" -type f | wc -l)" 1
}

@test "claude accounts: the override follows the project and comes after the other overlays" {
  claude_home
  mkdir "${CLAUDE_HOME}/.claude-work"
  TESSERACT_HOST_CLAUDE_ACCOUNTS=work TESSERACT_COMPOSE_PROJECT=tesseract-two claude_sandbox --mode local --dind ps
  assert_success
  assert_equal "$(calls_of docker)" \
    "$(compose_prefix tesseract-two local dind) -f ${STATE}/tesseract/compose.tesseract-two.claude-accounts.yml ps"
}

@test "claude accounts: a missing directory is skipped with a warning and never created" {
  claude_home
  mkdir "${CLAUDE_HOME}/.claude-work"
  TESSERACT_HOST_CLAUDE_ACCOUNTS="personal work" claude_sandbox --mode local ps
  assert_success
  assert_output "sandbox: warning: Claude account 'personal' skipped: ${CLAUDE_HOME}/.claude-personal is not a directory"
  assert_file_not_exists "${CLAUDE_HOME}/.claude-personal"
  run grep -c 'type: bind' "${OVERRIDE}"
  assert_output 1
  grep -qx '      TESSERACT_CLAUDE_ACCOUNTS: "work"' "${OVERRIDE}"

  : > "${STUB_LOG}"
  TESSERACT_HOST_CLAUDE_ACCOUNTS=personal claude_sandbox --mode local ps
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract local) ps"
  assert_file_not_exists "${CLAUDE_HOME}/.claude-personal"
}

@test "claude accounts: name=/abs/path mounts another host dir, quoted for YAML and compose" {
  claude_home
  local dir="${BATS_TEST_TMPDIR}/odd\"dir\$x\\y"
  mkdir -p "${dir}"
  TESSERACT_HOST_CLAUDE_ACCOUNTS="team_2=${dir}" claude_sandbox --mode local ps
  assert_success
  grep -qxF "        source: \"${BATS_TEST_TMPDIR}/odd\\\"dir\$\$x\\\\y\"" "${OVERRIDE}"
  grep -qxF '        target: "/home/dev/.claude-team_2"' "${OVERRIDE}"
}

@test "claude accounts: invalid names, relative paths and duplicates fail before compose runs" {
  claude_home
  mkdir "${CLAUDE_HOME}/.claude-work"
  local value
  for value in Work -work "a/b" "../x" "work=" "x=relative/dir" "$(printf 'a%.0s' {1..33})"; do
    TESSERACT_HOST_CLAUDE_ACCOUNTS="${value}" claude_sandbox --mode local ps
    assert_failure 1
    assert_output --partial "sandbox: TESSERACT_HOST_CLAUDE_ACCOUNTS: "
  done
  TESSERACT_HOST_CLAUDE_ACCOUNTS="work,work" claude_sandbox --mode local ps
  assert_failure 1
  assert_output "sandbox: TESSERACT_HOST_CLAUDE_ACCOUNTS: account 'work' is listed twice"
  assert_equal "$(calls)" ""
  assert_file_not_exists "${STATE}/tesseract"
}

@test "claude accounts: a relative XDG_STATE_HOME falls back to ~/.local/state" {
  claude_home
  mkdir "${CLAUDE_HOME}/.claude-work"
  HOME="${CLAUDE_HOME}" XDG_STATE_HOME=relative TESSERACT_HOST_CLAUDE_ACCOUNTS=work run "${SANDBOX}" --mode local ps
  assert_success
  assert_file_exists "${CLAUDE_HOME}/.local/state/tesseract/compose.tesseract.claude-accounts.yml"
}

# --- migration from the theone/Monolith names -------------------------------------------

# A docker stub with state: STUB_VOLUMES lists existing volumes, STUB_LEGACY_RUNNING makes
# `docker ps` report a running theone project, STUB_IMAGES lists local images and
# STUB_FAIL_RUN makes `docker run` fail.
legacy_stub() {
  unset TESSERACT_SKIP_LEGACY_MIGRATION
  STATE="${BATS_TEST_TMPDIR}/state"
  export XDG_STATE_HOME="${STATE}"
  STUB_STATE="${BATS_TEST_TMPDIR}/stub-state"
  mkdir -p "${STUB_STATE}"
  touch "${STUB_STATE}/created"
  export STUB_STATE
  stub docker '
case "$1 $2" in
  "ps --filter") [[ -z "${STUB_LEGACY_RUNNING:-}" ]] || printf "theone-sandbox-1\ntheone-tailscale-1\n" ;;
  "volume create") printf "%s\n" "${@: -1}" >> "${STUB_STATE}/created" ;;
  "volume inspect") [[ " ${STUB_VOLUMES:-} " == *" $3 "* ]] || grep -qxF -- "$3" "${STUB_STATE}/created" || exit 1 ;;
  "image inspect") [[ " ${STUB_IMAGES:-} " == *" $3 "* ]] || grep -qxF -- "$3" "${STUB_STATE}/created" || exit 1 ;;
  "tag theone/sandbox:latest") printf "%s\n" "$3" >> "${STUB_STATE}/created" ;;
  "compose --project-name") [[ "$3 $4" != "theone down" ]] || pwd > "${STUB_STATE}/down.cwd" ;;
  "run --rm") [[ -z "${STUB_FAIL_RUN:-}" ]] || exit 1 ;;
esac
exit 0'
}

@test "legacy: THEONE_ and MONOLITH_ keys of the env file are renamed once, with a backup" {
  printf '%s\n' '# THEONE_MODE=commented' 'THEONE_MODE=local' 'export THEONE_CONTROLLER_HOST_PORT=7711' \
    '  THEONE_HOSTNAME="old box" # note' 'MONOLITH_HOSTNAME=mono' 'MONOLITH_TOKEN=tok' \
    'TESSERACT_VNC_HOST_PORT=5911' 'THEONE_VNC_HOST_PORT=5000' 'TS_AUTHKEY=k' > "${COMPOSE}/.env"
  chmod 0600 "${COMPOSE}/.env"
  cp "${COMPOSE}/.env" "${BATS_TEST_TMPDIR}/original"
  run "${SANDBOX}" ps
  assert_success
  assert_output "sandbox: renamed legacy keys in ${COMPOSE}/.env: THEONE_MODE -> TESSERACT_MODE, THEONE_CONTROLLER_HOST_PORT -> TESSERACT_CONTROLLER_HOST_PORT, THEONE_HOSTNAME -> TESSERACT_HOSTNAME, MONOLITH_TOKEN -> TESSERACT_TOKEN (original saved as ${COMPOSE}/.env.legacy-backup)"
  assert_equal "$(cat "${COMPOSE}/.env")" "$(printf '%s\n' '# THEONE_MODE=commented' 'TESSERACT_MODE=local' \
    'export TESSERACT_CONTROLLER_HOST_PORT=7711' '  TESSERACT_HOSTNAME="old box" # note' 'MONOLITH_HOSTNAME=mono' \
    'TESSERACT_TOKEN=tok' 'TESSERACT_VNC_HOST_PORT=5911' 'THEONE_VNC_HOST_PORT=5000' 'TS_AUTHKEY=k')"
  assert_equal "$(stat -c %a "${COMPOSE}/.env")" 600
  cmp "${COMPOSE}/.env.legacy-backup" "${BATS_TEST_TMPDIR}/original"
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract local) ps"
  assert_equal "$(last_env)" "127.0.0.1|tesseract|tesseract|7711|5911"

  : > "${STUB_LOG}"
  run "${SANDBOX}" ps
  assert_success
  assert_output ""
  cmp "${COMPOSE}/.env.legacy-backup" "${BATS_TEST_TMPDIR}/original"
}

@test "legacy: old default values of renamed keys move to tesseract, the hostname is kept" {
  printf '%s\n' 'THEONE_MODE=local' 'THEONE_COMPOSE_PROJECT=theone' 'export MONOLITH_VOLUME_PREFIX="monolith" # old' \
    "THEONE_IMAGE='theone/sandbox:latest'" 'THEONE_HOSTNAME=theone-sandbox' > "${COMPOSE}/.env"
  run "${SANDBOX}" ps
  assert_success
  assert_equal "$(cat "${COMPOSE}/.env")" "$(printf '%s\n' 'TESSERACT_MODE=local' 'TESSERACT_COMPOSE_PROJECT=tesseract' \
    'export TESSERACT_VOLUME_PREFIX="tesseract" # old' "TESSERACT_IMAGE='tesseract/sandbox:latest'" \
    'TESSERACT_HOSTNAME=theone-sandbox')"
  assert_equal "$(last_env)" "127.0.0.1|tesseract|tesseract|7700|5901"

  # Values other than the old defaults are kept.
  write_env THEONE_MODE=local THEONE_COMPOSE_PROJECT=theone2 THEONE_VOLUME_PREFIX=theone-old THEONE_IMAGE=theone/sandbox:dev
  run "${SANDBOX}" ps
  assert_success
  assert_equal "$(cat "${COMPOSE}/.env")" "$(printf '%s\n' TESSERACT_MODE=local TESSERACT_COMPOSE_PROJECT=theone2 \
    TESSERACT_VOLUME_PREFIX=theone-old TESSERACT_IMAGE=theone/sandbox:dev)"
}

@test "legacy: a carried-over THEONE_COMPOSE_PROJECT=theone moves the stack to tesseract" {
  legacy_stub
  write_env THEONE_MODE=local THEONE_COMPOSE_PROJECT=theone
  STUB_LEGACY_RUNNING=1 STUB_VOLUMES="theone-workspace" STUB_IMAGES="theone/sandbox:latest" run "${SANDBOX}" up
  assert_success
  assert_line "sandbox: tagging the existing theone/sandbox:latest image as tesseract/sandbox:latest"
  assert_line "sandbox: copying volume theone-workspace to tesseract-workspace with tesseract/sandbox:latest (theone-workspace is kept)"
  assert_equal "$(calls_of docker | tail -n 1)" "$(compose_prefix tesseract local) up --detach"
}

@test "legacy: a TESSERACT_COMPOSE_PROJECT=theone set by the user keeps the old stack and its volumes" {
  legacy_stub
  write_env TESSERACT_MODE=local TESSERACT_COMPOSE_PROJECT=theone
  STUB_LEGACY_RUNNING=1 STUB_VOLUMES="theone-workspace theone-home" STUB_IMAGES="theone/sandbox:latest" run "${SANDBOX}" up
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix theone local) up --detach"
  assert_file_not_exists "${STATE}/tesseract"
}

@test "legacy: exported THEONE_/MONOLITH_ variables are used when the new name is unset" {
  write_env TESSERACT_MODE=local
  THEONE_CONTROLLER_HOST_PORT=7712 MONOLITH_CONTROLLER_HOST_PORT=1 MONOLITH_VNC_HOST_PORT=5912 \
    THEONE_COMPOSE_PROJECT=old TESSERACT_COMPOSE_PROJECT=new run "${SANDBOX}" ps
  assert_success
  assert_line "sandbox: using THEONE_CONTROLLER_HOST_PORT as TESSERACT_CONTROLLER_HOST_PORT (rename it in your environment)"
  assert_line "sandbox: using MONOLITH_VNC_HOST_PORT as TESSERACT_VNC_HOST_PORT (rename it in your environment)"
  refute_output --partial MONOLITH_CONTROLLER_HOST_PORT
  refute_output --partial THEONE_COMPOSE_PROJECT
  assert_equal "$(last_env)" "127.0.0.1|new|new|7712|5912"
}

@test "legacy: up stops a running theone project, copies its volumes once and keeps them" {
  legacy_stub
  write_env TESSERACT_MODE=local
  STUB_LEGACY_RUNNING=1 STUB_IMAGES="theone/sandbox:latest" \
    STUB_VOLUMES="theone-workspace theone-home theone-tailscale theone-tailscale-run tesseract-home" run "${SANDBOX}" up
  assert_success
  assert_line "sandbox: stopping the legacy compose project 'theone' (theone-sandbox-1 theone-tailscale-1) so it does not clash with 'tesseract'; its volumes are kept"
  assert_line "sandbox: copying volume theone-workspace to tesseract-workspace with tesseract/sandbox:latest (theone-workspace is kept)"
  assert_line "sandbox: once the new stack works, the old volumes can be removed with: docker volume rm theone-workspace theone-tailscale"
  assert_line --partial "set TESSERACT_HOSTNAME=theone-sandbox to keep the old URL"
  local copy="run --rm --network none --user 0:0 --entrypoint /bin/sh"
  assert_line "sandbox: tagging the existing theone/sandbox:latest image as tesseract/sandbox:latest"
  assert_equal "$(calls_of docker)" "image inspect tesseract/sandbox:latest
image inspect theone/sandbox:latest
tag theone/sandbox:latest tesseract/sandbox:latest
ps --filter label=com.docker.compose.project=theone --format \{\{.Names\}\}
compose --project-name theone down
volume inspect tesseract-workspace
volume inspect theone-workspace
image inspect tesseract/sandbox:latest
volume create --label com.docker.compose.project=tesseract --label com.docker.compose.volume=tesseract-workspace tesseract-workspace
${copy} -v theone-workspace:/from:ro -v tesseract-workspace:/to tesseract/sandbox:latest -c cp\ -a\ /from/.\ /to/
volume inspect tesseract-home
volume inspect tesseract-tailscale
volume inspect theone-tailscale
volume create --label com.docker.compose.project=tesseract --label com.docker.compose.volume=tesseract-tailscale tesseract-tailscale
${copy} -v theone-tailscale:/from:ro -v tesseract-tailscale:/to tesseract/sandbox:latest -c cp\ -a\ /from/.\ /to/
volume inspect tesseract-dind-certs
volume inspect theone-dind-certs
volume inspect tesseract-dind-data
volume inspect theone-dind-data
$(compose_prefix tesseract local) up --detach"
  refute_output --partial tailscale-run
  [[ "$(cat "${STUB_STATE}/down.cwd")" != "${COMPOSE}" ]]
  assert_file_exists "${STATE}/tesseract/legacy-volumes.tesseract.migrated"

  # Once migrated, a later `down -v` must not bring the old data back.
  : > "${STUB_LOG}"
  STUB_VOLUMES="theone-workspace" run "${SANDBOX}" up
  assert_success
  assert_equal "$(calls_of docker)" "image inspect tesseract/sandbox:latest
ps --filter label=com.docker.compose.project=theone --format \{\{.Names\}\}
$(compose_prefix tesseract local) up --detach"
}

@test "legacy: a copied tailscale volume counts as the existing node state" {
  legacy_stub
  write_env TS_TAILNET_DOMAIN=tail1234.ts.net TESSERACT_HOSTNAME=box
  STUB_VOLUMES="theone-tailscale" run "${SANDBOX}" up
  assert_success
  refute_output --partial "TS_AUTHKEY is required"
  refute_output --partial "TESSERACT_HOSTNAME=theone-sandbox"
  assert_line "sandbox: copying volume theone-tailscale to tesseract-tailscale with alpine:latest (theone-tailscale is kept)"
}

@test "legacy: a failed copy removes the new volume again and stops before compose up" {
  legacy_stub
  write_env TESSERACT_MODE=local
  STUB_FAIL_RUN=1 STUB_VOLUMES="theone-home" STUB_IMAGES="busybox:latest" run "${SANDBOX}" up
  assert_failure 1
  assert_output --partial "sandbox: copying theone-home to tesseract-home failed (tesseract-home removed again, theone-home untouched)"
  assert_equal "$(calls_of docker | tail -n 2 | head -n 1 | cut -d' ' -f1-2)" "run --rm"
  assert_equal "$(calls_of docker | tail -n 1)" "volume rm tesseract-home"
  assert_file_not_exists "${STATE}/tesseract/legacy-volumes.tesseract.migrated"
}

@test "legacy: other projects, other volume prefixes and TESSERACT_SKIP_LEGACY_MIGRATION skip the docker part" {
  legacy_stub
  write_env TESSERACT_MODE=local TESSERACT_COMPOSE_PROJECT=tesseract-two
  STUB_LEGACY_RUNNING=1 STUB_VOLUMES="theone-home" run "${SANDBOX}" up
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract-two local) up --detach"

  : > "${STUB_LOG}"
  write_env TESSERACT_MODE=local TESSERACT_VOLUME_PREFIX=mine
  STUB_LEGACY_RUNNING= STUB_VOLUMES="theone-home" run "${SANDBOX}" up
  assert_success
  assert_equal "$(calls_of docker)" "image inspect tesseract/sandbox:latest
image inspect theone/sandbox:latest
ps --filter label=com.docker.compose.project=theone --format \{\{.Names\}\}
$(compose_prefix tesseract local) up --detach"

  : > "${STUB_LOG}"
  write_env TESSERACT_MODE=local
  TESSERACT_SKIP_LEGACY_MIGRATION=1 STUB_LEGACY_RUNNING=1 STUB_VOLUMES="theone-home" run "${SANDBOX}" up
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix tesseract local) up --detach"
  assert_file_not_exists "${STATE}/tesseract"
}
