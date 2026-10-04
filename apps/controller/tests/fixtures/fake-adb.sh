#!/usr/bin/env bash
# Stand-in for the adb client: records every call in adb.log next to this script and
# keeps `adb connect` serials in adb.devices so `adb devices` lists them; `adb.connect-fails` makes connect fail.
set -u
dir=$(dirname "$0")
echo "$*" >> "$dir/adb.log"
touch "$dir/adb.devices"
case "${1:-}" in
  connect)
    [[ -e "$dir/adb.connect-fails" ]] && { echo "failed to connect to $2"; exit 1; }
    echo "$2" >> "$dir/adb.devices"
    echo "connected to $2"
    ;;
  disconnect)
    grep -vxF "$2" "$dir/adb.devices" > "$dir/adb.devices.new" || true
    mv "$dir/adb.devices.new" "$dir/adb.devices"
    echo "disconnected $2"
    ;;
  devices)
    echo "List of devices attached"
    while IFS= read -r serial; do printf '%s\tdevice\n' "$serial"; done < "$dir/adb.devices"
    ;;
esac
