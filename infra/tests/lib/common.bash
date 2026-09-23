bats_load_library bats-support
bats_load_library bats-assert
bats_load_library bats-file

REPO="${THEONE_TEST_REPO:-$(cd -- "${BATS_TEST_DIRNAME}/../.." && pwd -P)}"
ROOTFS="${REPO}/infra/docker/sandbox/rootfs"
ROOTFS_BIN="${ROOTFS}/usr/local/bin"

# Puts an empty stub directory first on PATH; every stub appends its argv (%q-quoted,
# one call per line) to $STUB_LOG.
setup_stubs() {
  STUB_BIN="${BATS_TEST_TMPDIR}/stub-bin"
  STUB_LOG="${BATS_TEST_TMPDIR}/calls.log"
  mkdir -p "${STUB_BIN}"
  : > "${STUB_LOG}"
  export STUB_BIN STUB_LOG
  export PATH="${STUB_BIN}:${PATH}"
}

# Usage: stub <name> [shell body run after the call is logged]
stub() {
  local name=$1 body=${2:-}
  cat > "${STUB_BIN}/${name}" << EOF
#!/usr/bin/env bash
{ printf '%s' '${name}'; printf ' %q' "\$@"; printf '\n'; } >> "\${STUB_LOG}"
${body}
EOF
  chmod +x "${STUB_BIN}/${name}"
}

calls() {
  cat "${STUB_LOG}"
}

# Prints the logged calls of one stub, without the command name.
calls_of() {
  sed -n "s/^$1 //p; s/^$1\$//p" "${STUB_LOG}"
}

# PATH with the stubs and the system directories only (no docker, tailscale, …).
minimal_path() {
  printf '%s:/usr/sbin:/usr/bin:/sbin:/bin' "${STUB_BIN}"
}

unset_theone_env() {
  local name
  for name in $(compgen -e); do
    case "${name}" in
      THEONE_TEST_*) ;;
      THEONE_* | TS_* | ANTHROPIC_* | CLAUDE_CODE_* | DOCKER_HOST | DISPLAY) unset "${name}" ;;
    esac
  done
}
