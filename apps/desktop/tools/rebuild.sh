#!/usr/bin/env bash
# Rebuilds the Monolith desktop companion from this checkout: icons from the mobile artwork, fresh bytecode,
# tests, the launcher/menu entry/icons (tools/install.sh), then restarts the running instance.
set -euo pipefail

usage() {
  cat << 'USAGE'
Usage: tools/rebuild.sh [--skip-tests] [--no-restart]

  --skip-tests   do not run pytest
  --no-restart   leave the running instance alone (new code loads on its next start)
USAGE
}

readonly DESKTOP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly LAUNCHER="${XDG_BIN_HOME:-${HOME}/.local/bin}/monolith"

running() { pgrep -f "python3 -m monolith_desktop" > /dev/null; }

restart_app() {
  if running; then
    echo "==> Quitting the running instance"
    "${LAUNCHER}" --quit || true
    local i
    for i in {1..50}; do
      running || break
      sleep 0.1
    done
    if running; then
      echo "    did not quit in 5 s; sending SIGTERM"
      pkill -f "python3 -m monolith_desktop" || true
      sleep 0.5
    fi
  fi
  echo "==> Starting Monolith"
  setsid -f "${LAUNCHER}" > /dev/null 2>&1 < /dev/null
}

main() {
  local tests=true restart=true
  while (($# > 0)); do
    case "$1" in
      --skip-tests) tests=false ;;
      --no-restart) restart=false ;;
      -h | --help)
        usage
        return 0
        ;;
      *)
        usage >&2
        return 2
        ;;
    esac
    shift
  done

  cd "${DESKTOP_DIR}"

  echo "==> Icons"
  if command -v magick > /dev/null; then
    tools/make-icons.sh
  else
    echo "    ImageMagick 7 not found; keeping the committed icons"
  fi

  echo "==> Bytecode"
  find monolith_desktop tests tools -type d -name __pycache__ -prune -exec rm -rf {} +
  python3 -m compileall -q monolith_desktop tests

  if [[ "${tests}" == true ]]; then
    echo "==> Tests"
    python3 -m pytest -q tests
  fi

  echo "==> Install"
  tools/install.sh

  if [[ "${restart}" == true ]]; then
    restart_app
  fi
  echo "Done."
}

main "$@"
