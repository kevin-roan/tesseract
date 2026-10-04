#!/usr/bin/env bash
# Installs the Monolith desktop companion for the current user: the `monolith` launcher, the app-menu
# entry and its icon (XDG user dirs). It runs from this checkout, so pulling new code needs no reinstall.
set -euo pipefail

usage() {
  cat << 'USAGE'
Usage: tools/install.sh [--autostart] [--uninstall]

  (no option)   install the `monolith` command, the app-menu entry and the icon
  --autostart   also start Monolith in the tray at login (XDG autostart: GNOME, KDE, XFCE…;
                on Hyprland/Sway add `exec-once = monolith --hidden` to your config instead)
  --uninstall   remove everything this script installed
USAGE
}

readonly APP_ID="dev.monolith.Desktop"
readonly DESKTOP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly BIN_DIR="${XDG_BIN_HOME:-${HOME}/.local/bin}"
readonly DATA_HOME="${XDG_DATA_HOME:-${HOME}/.local/share}"
readonly CONFIG_HOME="${XDG_CONFIG_HOME:-${HOME}/.config}"
readonly LAUNCHER="${BIN_DIR}/monolith"
readonly ENTRY="${DATA_HOME}/applications/${APP_ID}.desktop"
readonly ICON_THEME="${DATA_HOME}/icons/hicolor"
readonly ICON_SIZES=(16 22 24 32 48 64 128 256 512)
readonly AUTOSTART="${CONFIG_HOME}/autostart/${APP_ID}.desktop"

refresh_caches() {
  if command -v update-desktop-database > /dev/null; then
    update-desktop-database -q "${DATA_HOME}/applications" || true
  fi
  # A stale cache hides newer icons from GTK; drop it when it cannot be rebuilt (another app's odd file names).
  if command -v gtk-update-icon-cache > /dev/null && [[ -f "${ICON_THEME}/index.theme" || -f "${ICON_THEME}/.icon-theme.cache" ]]; then
    gtk-update-icon-cache -q -f -t "${ICON_THEME}" 2> /dev/null || rm -f "${ICON_THEME}/.icon-theme.cache"
  fi
}

write_launcher() {
  mkdir -p "${BIN_DIR}"
  cat > "${LAUNCHER}" << EOF
#!/usr/bin/env bash
# Launch the Monolith desktop companion (${DESKTOP_DIR}). Keeps the caller's cwd for --sync.
export PYTHONPATH="${DESKTOP_DIR}\${PYTHONPATH:+:\$PYTHONPATH}"
exec python3 -m monolith_desktop "\$@"
EOF
  chmod 0755 "${LAUNCHER}"
}

# The repo's .desktop file with Exec pointing at the launcher (the menu does not see ~/.local/bin on every PATH).
write_entry() {
  local target="$1" extra="$2"
  mkdir -p "$(dirname "${target}")"
  sed -e "s|^Exec=.*|Exec=${LAUNCHER}${extra}|" "${DESKTOP_DIR}/data/${APP_ID}.desktop" > "${target}"
  if [[ -z "${extra}" ]]; then
    cat >> "${target}" << EOF
Actions=quit;

[Desktop Action quit]
Name=Quit Monolith
Exec=${LAUNCHER} --quit
EOF
  else
    printf 'X-GNOME-Autostart-enabled=true\n' >> "${target}"
  fi
}

# The PNGs made by tools/make-icons.sh (the mobile app icon); drops the older scalable SVG.
install_icons() {
  local size
  rm -f "${ICON_THEME}/scalable/apps/${APP_ID}.svg"
  for size in "${ICON_SIZES[@]}"; do
    mkdir -p "${ICON_THEME}/${size}x${size}/apps"
    cp "${DESKTOP_DIR}/data/icons/hicolor/${size}x${size}/apps/${APP_ID}.png" "${ICON_THEME}/${size}x${size}/apps/${APP_ID}.png"
  done
}

remove_icons() {
  local size
  rm -f "${ICON_THEME}/scalable/apps/${APP_ID}.svg"
  for size in "${ICON_SIZES[@]}"; do
    rm -f "${ICON_THEME}/${size}x${size}/apps/${APP_ID}.png"
  done
}

install_all() {
  write_launcher
  write_entry "${ENTRY}" ""
  install_icons
  refresh_caches
  echo "Installed: ${LAUNCHER}, ${ENTRY}, icons in ${ICON_THEME}"
  case ":${PATH}:" in
    *":${BIN_DIR}:"*) ;;
    *) echo "note: ${BIN_DIR} is not on PATH; add it to use 'monolith' in a terminal" ;;
  esac
}

uninstall_all() {
  rm -f "${LAUNCHER}" "${ENTRY}" "${AUTOSTART}"
  remove_icons
  refresh_caches
  echo "Removed the Monolith launcher, menu entry, icon and autostart entry"
}

main() {
  local autostart=false
  while (($# > 0)); do
    case "$1" in
      --autostart) autostart=true ;;
      --uninstall)
        uninstall_all
        return 0
        ;;
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
  install_all
  if [[ "${autostart}" == true ]]; then
    write_entry "${AUTOSTART}" " --hidden"
    echo "Autostart: ${AUTOSTART}"
  fi
}

main "$@"
