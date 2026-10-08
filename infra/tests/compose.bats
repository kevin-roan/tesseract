#!/usr/bin/env bats
# Assertions on the compose configurations that infra/tests/run renders on the host with the
# real `docker compose config` (through infra/scripts/sandbox) for every mode.

load lib/common

setup() {
  RENDERED="${THEONE_TEST_COMPOSE_DIR:-}"
  [[ -n "${RENDERED}" && -d "${RENDERED}" ]] || skip "no rendered configs (run through infra/tests/run on a host with docker)"
}

q() {
  jq -r "$2" "${RENDERED}/$1.json"
}

@test "local: ports are published on 127.0.0.1 only, whatever THEONE_BIND_ADDR says" {
  assert_equal "$(q local '[.services.sandbox.ports[].host_ip] | unique | join(",")')" "127.0.0.1"
  assert_equal "$(q local '[.services.sandbox.ports[] | "\(.published)->\(.target)"] | join(",")')" "17710->7700,15910->5901"
  assert_equal "$(q local '.services.sandbox.environment.THEONE_PUBLIC_URL')" "http://127.0.0.1:17710"
  assert_equal "$(q local '.services | keys | join(",")')" "sandbox"
}

@test "host-tailscale: ports are published on the configured tailscale address only" {
  assert_equal "$(q host-tailscale '[.services.sandbox.ports[].host_ip] | unique | join(",")')" "100.64.0.1"
  assert_equal "$(q host-tailscale '.services.sandbox.environment.THEONE_PUBLIC_URL')" "http://100.64.0.1:17710"
}

@test "tailscale: nothing is published on the host and the sandbox shares the sidecar's network" {
  assert_equal "$(q tailscale '[.services[].ports // [] | length] | add')" "0"
  assert_equal "$(q tailscale '.services.sandbox.network_mode')" "service:tailscale"
  assert_equal "$(q tailscale '.services.sandbox.hostname // "none"')" "none"
  assert_equal "$(q tailscale '.services.sandbox.environment.THEONE_PUBLIC_URL')" "https://theone-test.tail.ts.net"
  assert_equal "$(q tailscale '.services.tailscale.environment.TS_HOSTNAME')" "theone-test"
  assert_equal "$(q tailscale '[.services.tailscale.volumes[] | select(.target == "/config") | .read_only] | .[0]')" "true"
}

@test "tailscale: secrets only reach the container that needs them" {
  assert_equal "$(q tailscale '.services.tailscale.environment.TS_AUTHKEY')" "tskey-auth-test"
  assert_equal "$(q tailscale '.services.sandbox.environment | has("TS_AUTHKEY")')" "false"
  assert_equal "$(q tailscale '.services.tailscale.environment | has("THEONE_TOKEN") or has("THEONE_VNC_PASSWORD")')" "false"
  assert_equal "$(q tailscale '.services.sandbox.environment | has("ANTHROPIC_API_KEY") or has("CLAUDE_CODE_OAUTH_TOKEN")')" "false"
}

@test "volumes follow THEONE_VOLUME_PREFIX in every mode" {
  local variant
  for variant in local host-tailscale tailscale local-dind tailscale-dind host-tailscale-tsapi tailscale-tsapi; do
    run q "${variant}" '[.volumes[].name] | sort | join(",")'
    case "${variant}" in
      tailscale-tsapi) assert_output "vt-home,vt-tailscale,vt-tailscale-run,vt-workspace" ;;
      tailscale-dind) assert_output "vt-dind-certs,vt-dind-data,vt-home,vt-tailscale,vt-workspace" ;;
      tailscale) assert_output "vt-home,vt-tailscale,vt-workspace" ;;
      local-dind) assert_output "vt-dind-certs,vt-dind-data,vt-home,vt-workspace" ;;
      *) assert_output "vt-home,vt-workspace" ;;
    esac
    assert_equal "$(q "${variant}" '.name')" "theone-test-config"
  done
}

@test "the sandbox is never privileged and drops every capability it does not need" {
  local variant
  for variant in local host-tailscale tailscale local-dind tailscale-dind host-tailscale-tsapi tailscale-tsapi; do
    assert_equal "$(q "${variant}" '.services.sandbox.privileged // false')" "false"
    assert_equal "$(q "${variant}" '.services.sandbox.cap_drop | join(",")')" "ALL"
    assert_equal "$(q "${variant}" '.services.sandbox.cap_add | map(select(. == "SYS_ADMIN" or . == "NET_ADMIN" or . == "SYS_PTRACE")) | length')" "0"
  done
}

@test "no service publishes a port on every interface" {
  local variant
  for variant in local host-tailscale tailscale local-dind tailscale-dind host-tailscale-tsapi tailscale-tsapi; do
    assert_equal "$(q "${variant}" '[.services[].ports // [] | .[] | select((.host_ip // "") == "" or .host_ip == "0.0.0.0" or .host_ip == "::")] | length')" "0"
  done
}

@test "dind: only the docker sidecar is privileged, the sandbox talks TLS with read-only certs" {
  local variant
  for variant in local-dind tailscale-dind; do
    assert_equal "$(q "${variant}" '.services.docker.privileged')" "true"
    assert_equal "$(q "${variant}" '.services.sandbox.environment.DOCKER_HOST')" "tcp://docker:2376"
    assert_equal "$(q "${variant}" '.services.sandbox.environment.DOCKER_TLS_VERIFY')" "1"
    assert_equal "$(q "${variant}" '[.services.sandbox.volumes[] | select(.target == "/certs/client") | .read_only] | .[0]')" "true"
    assert_equal "$(q "${variant}" '.services.docker.ports // [] | length')" "0"
  done
  assert_equal "$(q local '.services | has("docker")')" "false"
}

@test "tailscale-api (host): the host socket directory is mounted read-only, nothing else" {
  assert_equal "$(q host-tailscale-tsapi '[.services.sandbox.volumes[] | select(.type == "bind" and .target != "/home/dev/.claude")] | length')" "1"
  assert_equal "$(q host-tailscale-tsapi '.services.sandbox.volumes[] | select(.type == "bind" and .target != "/home/dev/.claude") | "\(.source)->\(.target) ro=\(.read_only)"')" "/srv/tailscale->/run/tailscale ro=true"
  assert_equal "$(q host-tailscale-tsapi '.services.sandbox.environment.THEONE_TAILSCALE_SOCKET')" "/run/tailscale/tailscaled.sock"
  assert_equal "$(q host-tailscale '[.services.sandbox.volumes[] | select(.target == "/run/tailscale")] | length')" "0"
  assert_equal "$(q host-tailscale '.services.sandbox.environment | has("THEONE_TAILSCALE_SOCKET")')" "false"
}

@test "tailscale-api (sidecar): the socket volume is shared, read-only for the sandbox" {
  assert_equal "$(q tailscale-tsapi '.services.tailscale.environment.TS_SOCKET')" "/var/run/tailscale/tailscaled.sock"
  assert_equal "$(q tailscale-tsapi '.services.tailscale.volumes[] | select(.target == "/var/run/tailscale") | .source')" "theone-tailscale-run"
  assert_equal "$(q tailscale-tsapi '.services.sandbox.volumes[] | select(.target == "/run/tailscale") | "\(.source) ro=\(.read_only)"')" "theone-tailscale-run ro=true"
  assert_equal "$(q tailscale-tsapi '.services.sandbox.environment.THEONE_TAILSCALE_SOCKET')" "/run/tailscale/tailscaled.sock"
  assert_equal "$(q tailscale-tsapi '[.services.sandbox.volumes[] | select(.type == "bind" and .target != "/home/dev/.claude")] | length')" "0"
  assert_equal "$(q tailscale '.services.tailscale.environment | has("TS_SOCKET")')" "false"
}

@test "claude: the host's Claude dir overlays /home/dev/.claude in every mode; no token passthrough" {
  local variant
  for variant in local host-tailscale tailscale local-dind tailscale-dind host-tailscale-tsapi tailscale-tsapi; do
    assert_equal "$(q "${variant}" '[.services.sandbox.volumes[] | .target] | (index("/home/dev") < index("/home/dev/.claude"))')" "true"
    assert_equal "$(q "${variant}" '.services.sandbox.volumes[] | select(.target == "/home/dev/.claude") | "\(.type) \(.source) ro=\(.read_only // false) create=\(.bind.create_host_path)"')" "bind /srv/claude ro=false create=false"
    assert_equal "$(q "${variant}" '.services.sandbox.environment | has("CLAUDE_CODE_OAUTH_TOKEN")')" "false"
    assert_equal "$(q "${variant}" '[.services[] | select(.volumes) | .volumes[] | select(.source == "/srv/claude")] | length')" "1"
  done
}

@test "claude accounts: each extra host Claude dir is a live bind mount at /home/dev/.claude-<name>" {
  local variant=local-claude-accounts
  assert_equal "$(q "${variant}" '.services.sandbox.environment.THEONE_CLAUDE_ACCOUNTS')" "work,other"
  assert_equal "$(q "${variant}" '[.services.sandbox.volumes[] | select(.target | startswith("/home/dev/.claude-")) | "\(.type) \(.source | split("/") | last)->\(.target) ro=\(.read_only // false) create=\(.bind.create_host_path)"] | join(",")')" \
    "bind claude-work->/home/dev/.claude-work ro=false create=false,bind claude-other->/home/dev/.claude-other ro=false create=false"
  assert_equal "$(q "${variant}" '.services.sandbox.volumes[] | select(.target == "/home/dev/.claude") | .source')" "/srv/claude"
  assert_equal "$(q "${variant}" '[.services.sandbox.volumes[] | .target] | (index("/home/dev") < index("/home/dev/.claude-work"))')" "true"
  assert_equal "$(q local '.services.sandbox.environment | has("THEONE_CLAUDE_ACCOUNTS")')" "false"
}

@test "host android: the host SDK and Gradle cache are read-only bind mounts, off by default" {
  local variant=local-host-android
  assert_equal "$(q "${variant}" '[.services.sandbox.volumes[] | select(.target | startswith("/opt/")) | "\(.type) \(.source)->\(.target) ro=\(.read_only) create=\(.bind.create_host_path)"] | join(",")')" \
    "bind /srv/android-sdk->/opt/android-sdk ro=true create=false,bind /srv/gradle/caches->/opt/gradle-ro-cache ro=true create=false"
  assert_equal "$(q "${variant}" '.services.sandbox.environment.GRADLE_RO_DEP_CACHE')" "/opt/gradle-ro-cache"
  assert_equal "$(q local '[.services.sandbox.volumes[] | select(.target | startswith("/opt/"))] | length')" "0"
  assert_equal "$(q local '.services.sandbox.environment | has("GRADLE_RO_DEP_CACHE")')" "false"
}
