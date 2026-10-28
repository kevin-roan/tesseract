#!/bin/bash
# Prepares a Mac for the host daemon's iOS Simulator support: Xcode (selected, license, first
# launch, an iOS runtime and an iPhone simulator), idb_companion and the idb CLI. Safe to re-run.
# docs/architecture/ios-simulator-macos.md, docs/runbooks/mac-server.md (iOS Simulator on the Mac).
#
#   scripts/setup-mac-ios.sh [--yes]
#
# Optional input (the daemon reads the same variables):
#   TESSERACT_XCRUN          xcrun to use (default /usr/bin/xcrun)
#   TESSERACT_IDB            idb CLI to use instead of installing fb-idb
#   TESSERACT_IDB_COMPANION  idb_companion to use instead of installing idb-companion
#   TESSERACT_SIMCAP         tesseract-simcap (H.264 screen helper) instead of ~/.tesseract/bin or the app's

set -euo pipefail

LOG="${HOME}/Library/Logs/tesseract-setup-mac-ios.log"
SERVICE_PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
APP_STORE_XCODE="macappstore://apps.apple.com/app/id497799835"

ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --yes|-y) ASSUME_YES=1 ;;
    -h|--help) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 64 ;;
  esac
done

mkdir -p "$(dirname "$LOG")"
exec > >(tee -a "$LOG") 2>&1

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok() { printf '\033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!\033[0m %s\n' "$*"; }
die() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; printf 'Log: %s\n' "$LOG" >&2; exit 1; }
confirm() {
  [ "$ASSUME_YES" = 1 ] && return 0
  local answer
  read -r -p "$1 [Y/n] " answer </dev/tty || true
  case "$answer" in [nN]*) return 1 ;; *) return 0 ;; esac
}

# The host daemon's search path (apps/controller/src/host/ios/config.ts): the LaunchAgent's PATH,
# then pipx's ~/.local/bin, then pip --user's ~/Library/Python/<version>/bin, newest first.
daemon_path() {
  local path="$SERVICE_PATH" dir
  [ -d "${HOME}/.local/bin" ] && path="${path}:${HOME}/.local/bin"
  while IFS= read -r dir; do
    [ -n "$dir" ] && path="${path}:${dir}"
  done < <(find "${HOME}/Library/Python" -mindepth 2 -maxdepth 2 -type d -name bin 2>/dev/null | sort -r)
  printf '%s' "$path"
}

# Resolves a tool the way the daemon does: an override with a slash must exist, else it is looked up on the daemon's path.
resolve_tool() {
  local override="$1" name="$2"
  if [ -n "$override" ]; then
    case "$override" in
      */*) [ -x "$override" ] && printf '%s' "$override"; return 0 ;;
      *) name="$override" ;;
    esac
  fi
  PATH="$(daemon_path)" command -v "$name" 2>/dev/null || true
}

find_xcode() {
  local developer candidate
  developer="$(xcode-select -p 2>/dev/null || true)"
  case "$developer" in
    *.app/Contents/Developer) [ -d "$developer" ] && { printf '%s' "${developer%/Contents/Developer}"; return 0; } ;;
  esac
  for candidate in /Applications/Xcode.app /Applications/Xcode-beta.app "${HOME}/Applications/Xcode.app"; do
    [ -d "${candidate}/Contents/Developer" ] && { printf '%s' "$candidate"; return 0; }
  done
  candidate="$(mdfind "kMDItemCFBundleIdentifier == 'com.apple.dt.Xcode'" 2>/dev/null | grep '\.app$' | head -n1 || true)"
  [ -n "$candidate" ] && [ -d "${candidate}/Contents/Developer" ] && { printf '%s' "$candidate"; return 0; }
  return 1
}

ios_runtimes() {
  "$XCRUN" simctl list -j runtimes available 2>/dev/null \
    | grep -oE '"identifier"[[:space:]]*:[[:space:]]*"com\.apple\.CoreSimulator\.SimRuntime\.iOS-[0-9-]+"' \
    | sed -E 's/.*"(com[^"]+)"$/\1/' | sort -V || true
}

iphone_names() {
  "$XCRUN" simctl list -j devices available 2>/dev/null \
    | grep -oE '"name"[[:space:]]*:[[:space:]]*"iPhone[^"]*"' \
    | sed -E 's/.*"(iPhone[^"]*)"$/\1/' || true
}

iphone_device_types() {
  "$XCRUN" simctl list devicetypes 2>/dev/null \
    | sed -nE 's/^(iPhone[^(]*[^ (]) \((com\.apple\.CoreSimulator\.SimDeviceType\.iPhone[^)]*)\)$/\2 \1/p' || true
}

# ---------------------------------------------------------------------------

step "Checking this Mac"
[ "$(uname -s)" = "Darwin" ] || die "The iOS Simulator only runs on macOS (with Xcode)."
[ "$(id -u)" != 0 ] || die "Run it as your normal user, not with sudo; it asks for sudo where needed."
ok "macOS $(sw_vers -productVersion) on $(uname -m)"

step "Xcode"
XCODE="$(find_xcode || true)"
if [ -z "$XCODE" ]; then
  die "Xcode is not installed (the Command Line Tools alone have no Simulator). Install Xcode from the App Store (open ${APP_STORE_XCODE}), open it once, then re-run this script."
fi
developer_dir="$(xcode-select -p 2>/dev/null || true)"
if [ "$developer_dir" != "${XCODE}/Contents/Developer" ]; then
  warn "xcode-select points at ${developer_dir:-nothing}, not ${XCODE}."
  confirm "Switch it with: sudo xcode-select -s ${XCODE}/Contents/Developer?" || die "simctl needs the full Xcode selected."
  sudo xcode-select -s "${XCODE}/Contents/Developer"
fi
ok "$(xcodebuild -version 2>/dev/null | head -n1) at ${XCODE}"
if ! xcodebuild -license check >/dev/null 2>&1; then
  confirm "The Xcode license is not accepted yet. Accept it with: sudo xcodebuild -license accept?" || die "simctl does not run until the license is accepted."
  sudo xcodebuild -license accept
fi
ok "license accepted"
if ! xcodebuild -checkFirstLaunchStatus >/dev/null 2>&1; then
  warn "Xcode's first launch tasks have not run; installing its system packages"
  sudo xcodebuild -runFirstLaunch
fi
ok "first launch tasks done"

XCRUN="$(resolve_tool "${TESSERACT_XCRUN:-}" xcrun)"
[ -z "${TESSERACT_XCRUN:-}" ] && [ -x /usr/bin/xcrun ] && XCRUN=/usr/bin/xcrun
[ -n "$XCRUN" ] || die "xcrun not found${TESSERACT_XCRUN:+ (TESSERACT_XCRUN=${TESSERACT_XCRUN})}."
"$XCRUN" simctl help >/dev/null 2>&1 || die "\`${XCRUN} simctl help\` fails. Check: xcode-select -p, xcodebuild -license check."
ok "simctl works (${XCRUN})"

step "iOS Simulator runtime"
runtimes="$(ios_runtimes)"
if [ -z "$runtimes" ]; then
  confirm "No iOS Simulator runtime is installed. Download one with: xcodebuild -downloadPlatform iOS (several GB)?" || die "An iOS runtime is required. Xcode → Settings → Components also installs one."
  xcodebuild -downloadPlatform iOS
  runtimes="$(ios_runtimes)"
  [ -n "$runtimes" ] || die "Still no iOS runtime after the download. Check Xcode → Settings → Components."
fi
runtime="$(printf '%s\n' "$runtimes" | tail -n1)"
ok "$(printf '%s\n' "$runtimes" | wc -l | tr -d ' ') iOS runtime(s), newest ${runtime##*.}"

step "iPhone simulator"
iphones="$(iphone_names)"
if [ -z "$iphones" ]; then
  warn "No iPhone simulator exists; creating one for ${runtime##*.}"
  created=""
  while read -r type name; do
    [ -n "$type" ] || continue
    if "$XCRUN" simctl create "$name" "$type" "$runtime" >/dev/null 2>&1; then created="$name"; break; fi
  done < <(iphone_device_types | sort -r -V)
  [ -n "$created" ] || die "Could not create an iPhone simulator. Create one in Xcode → Window → Devices and Simulators."
  iphones="$(iphone_names)"
fi
ok "$(printf '%s\n' "$iphones" | wc -l | tr -d ' ') iPhone simulator(s), e.g. $(printf '%s\n' "$iphones" | head -n1)"

step "Homebrew"
brew_bin="$(command -v brew || true)"
for candidate in /opt/homebrew/bin/brew /usr/local/bin/brew; do
  if [ -z "$brew_bin" ] && [ -x "$candidate" ]; then brew_bin="$candidate"; fi
done
[ -n "$brew_bin" ] || die "Homebrew is required. Install it from https://brew.sh (or run scripts/setup-mac.sh), then re-run this script."
eval "$("$brew_bin" shellenv)"
ok "Homebrew at $(brew --prefix)"

step "idb_companion"
COMPANION="$(resolve_tool "${TESSERACT_IDB_COMPANION:-}" idb_companion)"
if [ -n "${TESSERACT_IDB_COMPANION:-}" ]; then
  [ -n "$COMPANION" ] || die "TESSERACT_IDB_COMPANION=${TESSERACT_IDB_COMPANION} is not an executable."
elif ! brew list --formula idb-companion >/dev/null 2>&1; then
  brew tap facebook/fb
  brew install idb-companion
  hash -r
  COMPANION="$(resolve_tool "" idb_companion)"
fi
[ -n "$COMPANION" ] || die "idb_companion is installed but not on the daemon's path (${SERVICE_PATH}). Set TESSERACT_IDB_COMPANION to its full path."
ok "idb_companion at ${COMPANION}"

step "idb CLI (fb-idb)"
idb_works() {
  local idb
  idb="$(resolve_tool "${TESSERACT_IDB:-}" idb)"
  [ -n "$idb" ] && "$idb" --help >/dev/null 2>&1
}
pip_user_install() {
  local python=/usr/bin/python3
  [ -x "$python" ] || python="$(command -v python3 || true)"
  [ -n "$python" ] || die "No python3 for pip3 --user."
  "$python" -m pip install --user --upgrade fb-idb
}
if [ -n "${TESSERACT_IDB:-}" ]; then
  idb_works || die "TESSERACT_IDB=${TESSERACT_IDB} does not run (\`idb --help\` fails)."
elif ! idb_works; then
  if ! command -v pipx >/dev/null 2>&1; then
    brew install pipx || warn "brew install pipx failed; falling back to pip3 --user"
    hash -r
  fi
  if command -v pipx >/dev/null 2>&1; then
    pipx install --force fb-idb || warn "pipx install fb-idb failed"
  fi
  if ! idb_works; then
    if command -v pipx >/dev/null 2>&1; then pipx uninstall fb-idb >/dev/null 2>&1 || true; fi
    warn "idb from pipx does not run; installing fb-idb with pip3 --user"
    pip_user_install
  fi
  idb_works || die "idb does not run after installing fb-idb. Install it by hand (pipx install fb-idb) and set TESSERACT_IDB to its full path."
fi
IDB="$(resolve_tool "${TESSERACT_IDB:-}" idb)"
ok "idb at ${IDB}"

step "Smoke test"
"$XCRUN" simctl help >/dev/null 2>&1 || die "\`${XCRUN} simctl help\` fails."
ok "xcrun simctl help"
companion_version="$("$COMPANION" --version 2>/dev/null | head -n1 || true)"
if [ -z "$companion_version" ]; then
  "$COMPANION" --help >/dev/null 2>&1 || die "\`${COMPANION} --help\` fails. idb_companion may not support this Xcode; check \`brew upgrade idb-companion\`."
  companion_version="runs"
fi
ok "idb_companion: ${companion_version}"
"$IDB" --help >/dev/null 2>&1 || die "\`${IDB} --help\` fails."
ok "idb --help"
"$XCRUN" simctl list devices booted 2>/dev/null | grep -q '(Booted)' && ok "a simulator is booted" || ok "no simulator booted (the daemon boots one on request)"
# Optional H.264 screen helper (built by setup-server.sh / the app build); without it the screen is idb + ffmpeg JPEGs.
SIMCAP="${TESSERACT_SIMCAP:-}"
if [ -z "$SIMCAP" ]; then
  for candidate in "${HOME}/.tesseract/bin/tesseract-simcap" /Applications/Tesseract.app/Contents/Resources/bin/tesseract-simcap; do
    if [ -x "$candidate" ]; then SIMCAP="$candidate"; break; fi
  done
fi
if [ -z "$SIMCAP" ]; then
  warn "tesseract-simcap not found (run ./setup-server.sh or set TESSERACT_SIMCAP); the iOS screen will be idb + ffmpeg JPEGs"
elif ! simcap_version="$("$SIMCAP" --version 2>/dev/null)"; then
  warn "\`${SIMCAP} --version\` fails; the iOS screen will be idb + ffmpeg JPEGs"
else
  ok "tesseract-simcap ${simcap_version} at ${SIMCAP}"
  booted_udid="$("$XCRUN" simctl list devices booted 2>/dev/null | sed -n 's/.*(\([0-9A-Fa-f-]\{36\}\)) (Booted).*/\1/p' | head -n1 || true)"
  if [ -n "$booted_udid" ]; then
    if probe="$("$SIMCAP" probe --udid "$booted_udid" 2>/dev/null)"; then
      ok "tesseract-simcap probe: ${probe}"
    else
      warn "tesseract-simcap probe failed for ${booted_udid}: ${probe:-no output} (rebuild it after an Xcode update; the screen falls back to idb)"
    fi
  else
    ok "tesseract-simcap probe skipped (boot a simulator to test it)"
  fi
fi

step "Done"
echo "This Mac is ready for the iOS Simulator. Turn it on for the host daemon (off by default), one of:"
echo "  tesseract server install --ios          headless server: the host shell LaunchAgent gets TESSERACT_IOS=1"
echo "  Desktop app: Preferences → Host shell → \"iOS Simulator\""
echo "  TESSERACT_IOS=1 tesseract-controller host serve   by hand, in the foreground"
overrides=""
for name in TESSERACT_XCRUN TESSERACT_IDB TESSERACT_IDB_COMPANION TESSERACT_SIMCAP; do
  [ -n "${!name:-}" ] && overrides="${overrides} ${name}=${!name}"
done
if [ -n "$overrides" ]; then
  echo "Export the same overrides when installing the service:${overrides}"
fi
echo "Then: the host shell's Simulator view, or GET /v1/ios should report available: true."
echo "Not yet verified on a real Mac: docs/architecture/ios-simulator-macos.md §8."
echo "Log: ${LOG}"
