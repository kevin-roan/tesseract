#!/usr/bin/env bats
# infra/scripts/sandbox against a stub docker. The script runs through a symlink inside a
# temporary repo layout, so the real infra/compose/.env is never read.

load lib/common

setup() {
  unset_theone_env
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
  stub docker '
case "$*" in
  *" ps --status running --quiet sandbox") [[ -z "${STUB_RUNNING:-}" ]] || echo 0123abcd ;;
  "volume inspect "*) [[ -n "${STUB_VOLUME_EXISTS:-}" ]] || exit 1 ;;
esac
printf "%s|%s|%s|%s|%s\n" "${THEONE_BIND_ADDR-unset}" "${THEONE_COMPOSE_PROJECT-unset}" \
  "${THEONE_VOLUME_PREFIX-unset}" "${THEONE_CONTROLLER_HOST_PORT-unset}" "${THEONE_VNC_HOST_PORT-unset}" >> "${ENV_LOG}"
exit "${STUB_DOCKER_STATUS:-0}"'
}

write_env() {
  printf '%s\n' "$@" > "${COMPOSE}/.env"
}

compose_prefix() {
  local project=${1:-theone} overlay
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

@test "defaults to tailscale mode with project theone" {
  run "${SANDBOX}" ps
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix theone tailscale) ps"
  assert_equal "$(last_env)" "unset|theone|theone|7700|5901"
}

@test "local mode uses compose.local.yml bound to 127.0.0.1" {
  run "${SANDBOX}" --mode local ps -a
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix theone local) ps -a"
  assert_equal "$(last_env)" "127.0.0.1|theone|theone|7700|5901"
}

@test "local mode ignores THEONE_BIND_ADDR from the env file and the environment" {
  write_env THEONE_BIND_ADDR=0.0.0.0
  THEONE_BIND_ADDR=0.0.0.0 run "${SANDBOX}" --mode local ps
  assert_success
  assert_equal "$(last_env)" "127.0.0.1|theone|theone|7700|5901"
}

@test "--mode=VALUE and options after the command are accepted" {
  run "${SANDBOX}" ps --mode=local --dind
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix theone local dind) ps"
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

@test "mode precedence: --mode, then THEONE_MODE, then the env file, then tailscale" {
  write_env THEONE_MODE=host-tailscale THEONE_BIND_ADDR=100.64.0.7
  THEONE_MODE=local run "${SANDBOX}" --mode tailscale ps
  assert_equal "$(calls_of docker | tail -n 1)" "$(compose_prefix theone tailscale) ps"

  THEONE_MODE=local run "${SANDBOX}" ps
  assert_equal "$(calls_of docker | tail -n 1)" "$(compose_prefix theone local) ps"

  run "${SANDBOX}" ps
  assert_equal "$(calls_of docker | tail -n 1)" "$(compose_prefix theone local) ps"
  assert_equal "$(last_env)" "100.64.0.7|theone|theone|7700|5901"
}

@test "an empty exported variable falls back to the env file" {
  write_env THEONE_MODE=local
  THEONE_MODE="" run "${SANDBOX}" ps
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix theone local) ps"
}

@test "arguments after -- are passed through and never parsed as options" {
  run "${SANDBOX}" --mode local logs -- --mode lan --dind
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix theone local) logs --tail=200 -- --mode lan --dind"
}

@test "--dind and THEONE_DIND=1|true|yes add compose.dind.yml" {
  local value
  for value in 1 true yes; do
    : > "${STUB_LOG}"
    write_env THEONE_MODE=local "THEONE_DIND=${value}"
    run "${SANDBOX}" ps
    assert_success
    assert_equal "$(calls_of docker)" "$(compose_prefix theone local dind) ps"
  done
}

@test "THEONE_DIND=0|no|false|empty leaves dind out" {
  local value
  for value in 0 no false ""; do
    : > "${STUB_LOG}"
    write_env THEONE_MODE=local "THEONE_DIND=${value}"
    run "${SANDBOX}" ps
    assert_success
    assert_equal "$(calls_of docker)" "$(compose_prefix theone local) ps"
  done
}

@test "--tailscale-api and THEONE_TAILSCALE_LOCALAPI pick the overlay for the mode" {
  run "${SANDBOX}" --mode local --tailscale-api ps
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix theone local tailscale-api) ps"
  : > "${STUB_LOG}"
  write_env THEONE_TAILSCALE_LOCALAPI=1
  run "${SANDBOX}" ps
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix theone tailscale tailscale-api-sidecar) ps"
  : > "${STUB_LOG}"
  write_env THEONE_MODE=local THEONE_TAILSCALE_LOCALAPI=0
  run "${SANDBOX}" ps
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix theone local) ps"
}

@test "--tailscale-api up needs the host socket and warns about the trade-off" {
  local dir="${BATS_TEST_TMPDIR}/tsrun"
  mkdir -p "${dir}"
  write_env THEONE_MODE=local "THEONE_TAILSCALE_HOST_SOCKET_DIR=${dir}"
  run "${SANDBOX}" --tailscale-api up
  assert_failure 1
  assert_output --partial "no tailscaled socket at ${dir}/tailscaled.sock"
  assert_equal "$(calls_of docker)" ""
  python3 -c 'import socket,sys; socket.socket(socket.AF_UNIX).bind(sys.argv[1])' "${dir}/tailscaled.sock"
  run "${SANDBOX}" --tailscale-api up
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix theone local tailscale-api) up --detach"
  assert_output --partial "tailscale LocalAPI shared with the sandbox"
  write_env THEONE_MODE=local THEONE_TAILSCALE_HOST_SOCKET_DIR=relative
  run "${SANDBOX}" --tailscale-api ps
  assert_failure 1
  assert_output --partial "must be an absolute path"
}

@test "--env-file is passed to compose and replaces infra/compose/.env" {
  write_env THEONE_MODE=tailscale THEONE_COMPOSE_PROJECT=wrong
  printf 'THEONE_MODE=local\nTHEONE_COMPOSE_PROJECT=theone-alt\n' > "${BATS_TEST_TMPDIR}/alt.env"
  run "${SANDBOX}" --env-file "${BATS_TEST_TMPDIR}/alt.env" ps
  assert_success
  assert_equal "$(calls_of docker)" \
    "compose --project-name theone-alt --project-directory ${COMPOSE} --env-file ${BATS_TEST_TMPDIR}/alt.env -f ${COMPOSE}/compose.yml -f ${COMPOSE}/compose.local.yml ps"
}

@test "a relative --env-file=PATH is resolved against the working directory" {
  printf 'THEONE_MODE=local\n' > "${BATS_TEST_TMPDIR}/rel.env"
  cd "${BATS_TEST_TMPDIR}"
  run "${SANDBOX}" ps --env-file=rel.env
  assert_success
  assert_equal "$(calls_of docker)" \
    "compose --project-name theone --project-directory ${COMPOSE} --env-file ${BATS_TEST_TMPDIR}/rel.env -f ${COMPOSE}/compose.yml -f ${COMPOSE}/compose.local.yml ps"
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
    '# THEONE_COMPOSE_PROJECT=commented' \
    '  export THEONE_COMPOSE_PROJECT="quoted-project" # trailing' \
    "THEONE_VOLUME_PREFIX='single.quoted'" \
    'THEONE_CONTROLLER_HOST_PORT=17700 # comment' \
    'THEONE_VNC_HOST_PORT=15901   ' \
    'THEONE_MODE_EXTRA=tailscale' \
    'THEONE_MODE=local'
  run "${SANDBOX}" ps
  assert_success
  assert_equal "$(last_env)" "127.0.0.1|quoted-project|single.quoted|17700|15901"
}

@test "env file: the last assignment wins and a value may contain = and #" {
  write_env THEONE_MODE=tailscale THEONE_MODE=local 'THEONE_BIND_ADDR=x' \
    'TS_TAILNET_DOMAIN=a=b#c' 'THEONE_HOSTNAME=host#1'
  run "${SANDBOX}" --mode tailscale up
  assert_failure
  assert_output --partial "TS_AUTHKEY is required"

  printf 'TS_AUTHKEY=tskey\n' >> "${COMPOSE}/.env"
  run "${SANDBOX}" --mode tailscale up
  assert_success
  assert_output --partial "controller: https://host#1.a=b#c  VNC: host#1:5901"
}

@test "env file: CRLF line endings and a missing final newline are handled" {
  printf 'THEONE_COMPOSE_PROJECT=crlf\r\nTHEONE_MODE=local' > "${COMPOSE}/.env"
  run "${SANDBOX}" ps
  assert_success
  assert_equal "$(last_env)" "127.0.0.1|crlf|crlf|7700|5901"
}

@test "exported variables win over the env file" {
  write_env THEONE_MODE=local THEONE_COMPOSE_PROJECT=from-file THEONE_CONTROLLER_HOST_PORT=1111
  THEONE_COMPOSE_PROJECT=from-env THEONE_VOLUME_PREFIX=vols run "${SANDBOX}" ps
  assert_success
  assert_equal "$(last_env)" "127.0.0.1|from-env|vols|1111|5901"
}

@test "rejects invalid compose project names" {
  local name
  for name in Theone -theone "the one" "../x" "a/b"; do
    THEONE_COMPOSE_PROJECT="${name}" run "${SANDBOX}" --mode local ps
    assert_failure 1
    assert_output --partial "THEONE_COMPOSE_PROJECT=${name} is not a valid compose project name"
  done
  assert_equal "$(calls)" ""
}

@test "rejects invalid volume prefixes" {
  local prefix
  for prefix in .hidden "a b" "a/b" "-x"; do
    THEONE_VOLUME_PREFIX="${prefix}" run "${SANDBOX}" --mode local ps
    assert_failure 1
    assert_output --partial "THEONE_VOLUME_PREFIX=${prefix} is not a valid volume name prefix"
  done
}

@test "accepts ports 1 and 65535" {
  THEONE_CONTROLLER_HOST_PORT=1 THEONE_VNC_HOST_PORT=65535 run "${SANDBOX}" --mode local ps
  assert_success
  assert_equal "$(last_env)" "127.0.0.1|theone|theone|1|65535"
}

@test "rejects host ports that are not TCP ports" {
  local port
  for port in 0 65536 99999 080 abc 77.0 " 7700" -1 123456; do
    THEONE_CONTROLLER_HOST_PORT="${port}" run "${SANDBOX}" --mode local ps
    assert_failure 1
    assert_output "sandbox: THEONE_CONTROLLER_HOST_PORT=${port} is not a TCP port"
    THEONE_VNC_HOST_PORT="${port}" run "${SANDBOX}" --mode local ps
    assert_failure 1
    assert_output "sandbox: THEONE_VNC_HOST_PORT=${port} is not a TCP port"
  done
  assert_equal "$(calls)" ""
}

@test "host-tailscale uses THEONE_BIND_ADDR over tailscale ip -4" {
  stub tailscale 'echo 100.100.100.100'
  THEONE_BIND_ADDR=100.64.0.9 run "${SANDBOX}" --mode host-tailscale up
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix theone local) up --detach"
  assert_equal "$(last_env)" "100.64.0.9|theone|theone|7700|5901"
  assert_equal "$(calls_of tailscale)" ""
  assert_output --partial "controller: http://100.64.0.9:7700  VNC: 100.64.0.9:5901"
}

@test "host-tailscale takes the first address of tailscale ip -4" {
  stub tailscale 'printf "100.101.102.103\n100.64.0.1\n"'
  run "${SANDBOX}" --mode host-tailscale up
  assert_success
  assert_equal "$(calls_of tailscale)" "ip -4"
  assert_equal "$(last_env)" "100.101.102.103|theone|theone|7700|5901"
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
  assert_equal "$(calls_of docker)" "$(compose_prefix theone local) down --remove-orphans"
  assert_equal "$(last_env)" "127.0.0.1|theone|theone|7700|5901"
}

@test "host-tailscale refuses wildcard bind addresses" {
  local addr
  for addr in 0.0.0.0 :: "[::]" "*"; do
    THEONE_BIND_ADDR="${addr}" run "${SANDBOX}" --mode host-tailscale down
    assert_failure 1
    assert_output --partial "would publish the sandbox on every host interface"
  done
  assert_equal "$(calls)" ""
}

@test "host-tailscale refuses a wildcard address coming from the env file" {
  write_env THEONE_MODE=host-tailscale 'THEONE_BIND_ADDR="0.0.0.0"'
  run "${SANDBOX}" up
  assert_failure 1
  assert_output --partial "THEONE_BIND_ADDR=0.0.0.0 would publish the sandbox on every host interface"
  assert_equal "$(calls)" ""
}

@test "host-tailscale refuses other spellings of the wildcard address" {
  local addr
  for addr in "[::0]" "::0" "[0:0:0:0:0:0:0:0]" 0 0.0.0.1 " 0.0.0.0" "0.0.0.0 " "[::ffff:0.0.0.0]"; do
    THEONE_BIND_ADDR="${addr}" run "${SANDBOX}" --mode host-tailscale up
    assert_failure 1
    assert_output --partial "THEONE_BIND_ADDR="
  done
  assert_equal "$(calls)" ""
}

@test "host-tailscale refuses bind addresses that are not IPv4 literals" {
  local addr
  for addr in localhost my.host 100.64.0 100.64.0.1.2 256.1.1.1 "100.64.0.1:80" "100.64.0.1 -p" "[fd7a:115c:a1e0::1]"; do
    THEONE_BIND_ADDR="${addr}" run "${SANDBOX}" --mode host-tailscale up
    assert_failure 1
    assert_output --partial "is not an IPv4 address"
  done
  assert_equal "$(calls)" ""
}

@test "host-tailscale accepts a loopback or private IPv4" {
  local addr
  for addr in 127.0.0.1 100.64.0.1 192.168.1.20 10.0.0.255; do
    THEONE_BIND_ADDR="${addr}" run "${SANDBOX}" --mode host-tailscale up
    assert_success
    assert_equal "$(last_env)" "${addr}|theone|theone|7700|5901"
  done
}

@test "tailscale up requires TS_TAILNET_DOMAIN" {
  TS_AUTHKEY=tskey run "${SANDBOX}" up
  assert_failure 1
  assert_output --partial "TS_TAILNET_DOMAIN is required in tailscale mode"
  assert_equal "$(calls)" ""
}

@test "tailscale up requires TS_AUTHKEY while the state volume does not exist" {
  write_env TS_TAILNET_DOMAIN=tail1234.ts.net THEONE_VOLUME_PREFIX=pfx
  run "${SANDBOX}" up
  assert_failure 1
  assert_output --partial "TS_AUTHKEY is required for the first start"
  assert_equal "$(calls_of docker)" "volume inspect pfx-tailscale"
}

@test "tailscale up without TS_AUTHKEY works once the state volume exists" {
  write_env TS_TAILNET_DOMAIN=tail1234.ts.net
  STUB_VOLUME_EXISTS=1 run "${SANDBOX}" up
  assert_success
  assert_equal "$(calls_of docker)" "volume inspect theone-tailscale
$(compose_prefix theone tailscale) up --detach"
  assert_output --partial "controller: https://theone-sandbox.tail1234.ts.net  VNC: theone-sandbox:5901"
  assert_output --partial "pair the mobile app with: sandbox pair"
}

@test "tailscale up with TS_AUTHKEY skips the volume check and passes compose arguments" {
  write_env TS_TAILNET_DOMAIN=tail1234.ts.net TS_AUTHKEY=tskey-auth-x THEONE_HOSTNAME=box
  run "${SANDBOX}" up --build --dind
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix theone tailscale dind) up --detach --build"
  assert_output --partial "controller: https://box.tail1234.ts.net  VNC: box:5901"
}

@test "tailscale mode commands other than up need no tailnet configuration" {
  run "${SANDBOX}" logs -f
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix theone tailscale) logs --tail=200 -f"
}

@test "up in local mode reports the custom host ports" {
  write_env THEONE_MODE=local THEONE_CONTROLLER_HOST_PORT=17700 THEONE_VNC_HOST_PORT=15901
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
  prefix="$(compose_prefix theone local)"
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
    assert_equal "$(calls_of docker)" "$(compose_prefix theone local) ps --status running --quiet sandbox"
  done
}

@test "shell opens a login shell as dev in /workspace" {
  STUB_RUNNING=1 run "${SANDBOX}" --mode local shell
  assert_success
  assert_equal "$(calls_of docker | tail -n 1)" "$(compose_prefix theone local) exec -u dev -w /workspace sandbox bash -l"
}

@test "pair and doctor pass their arguments to the tools inside the sandbox" {
  STUB_RUNNING=1 run "${SANDBOX}" --mode local pair --json
  assert_success
  STUB_RUNNING=1 run "${SANDBOX}" --mode local doctor
  assert_success
  local prefix
  prefix="$(compose_prefix theone local)"
  assert_equal "$(calls_of docker | grep ' exec ')" "${prefix} exec -u dev sandbox theone-controller pair --json
${prefix} exec -u dev sandbox theone-doctor"
}

@test "status only queries the controller while the sandbox runs" {
  local prefix
  prefix="$(compose_prefix theone local)"
  run "${SANDBOX}" --mode local status
  assert_success
  assert_equal "$(calls_of docker)" "${prefix} ps
${prefix} ps --status running --quiet sandbox"

  : > "${STUB_LOG}"
  STUB_RUNNING=1 run "${SANDBOX}" --mode local status
  assert_success
  assert_equal "$(calls_of docker)" "${prefix} ps
${prefix} ps --status running --quiet sandbox
${prefix} exec -T -u dev sandbox theone-controller status"
}

@test "build without a target builds the sandbox service through compose" {
  run "${SANDBOX}" --mode local build --no-cache --pull
  assert_success
  assert_equal "$(calls_of docker)" "$(compose_prefix theone local) build --no-cache --pull sandbox"

  : > "${STUB_LOG}"
  run "${SANDBOX}" --mode local build --target sandbox
  assert_equal "$(calls_of docker)" "$(compose_prefix theone local) build sandbox"
}

@test "build --target <stage> tags theone/sandbox:<stage> with docker build" {
  run "${SANDBOX}" --mode local build --target electron --progress=plain
  assert_success
  assert_equal "$(calls_of docker)" \
    "build -f ${FAKE_REPO}/infra/docker/sandbox/Dockerfile --target electron -t theone/sandbox:electron --progress=plain ${FAKE_REPO}"

  : > "${STUB_LOG}"
  run "${SANDBOX}" --mode local build --target=base
  assert_equal "$(calls_of docker)" \
    "build -f ${FAKE_REPO}/infra/docker/sandbox/Dockerfile --target base -t theone/sandbox:base ${FAKE_REPO}"
}

@test "build --target without a stage fails" {
  run "${SANDBOX}" --mode local build --target
  assert_failure 1
  assert_output "sandbox: --target needs a stage name"
  assert_equal "$(calls)" ""
}

@test "custom project and volume prefix reach compose and the tailscale volume check" {
  write_env THEONE_COMPOSE_PROJECT=theone-two THEONE_VOLUME_PREFIX=two TS_TAILNET_DOMAIN=t.ts.net
  STUB_VOLUME_EXISTS=1 run "${SANDBOX}" up
  assert_success
  assert_equal "$(calls_of docker)" "volume inspect two-tailscale
$(compose_prefix theone-two tailscale) up --detach"
  assert_equal "$(last_env)" "unset|theone-two|two|7700|5901"
}
