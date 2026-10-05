#!/usr/bin/env bash
# Headless screenshot of the desktop app: tools/snapshot.sh out.png [--page ID] [--params JSON] [--prefs] [--light] [--width W --height H] [--delay S] [--collapsed-sidebar] [--zoom Z]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"

port_free() {
  python3 -c "import socket,sys; s=socket.socket(); s.bind(('127.0.0.1', 8080 + int(sys.argv[1]))); s.close()" "$1" 2>/dev/null
}

daemon=""
trap '[ -n "$daemon" ] && kill $daemon 2>/dev/null || true' EXIT
for _ in $(seq 1 20); do
  display=$(( 100 + RANDOM % 800 ))
  port_free "$display" || continue
  gtk4-broadwayd ":$display" >/dev/null 2>&1 &
  daemon=$!
  sleep 0.5
  if kill -0 "$daemon" 2>/dev/null; then
    break
  fi
  daemon=""
done
[ -n "$daemon" ] || { echo "could not start gtk4-broadwayd" >&2; exit 1; }

env -u WAYLAND_DISPLAY -u DISPLAY GDK_BACKEND=broadway BROADWAY_DISPLAY=":$display" GSK_RENDERER=cairo \
  timeout 60 python3 "$here/snapshot.py" "$@"
