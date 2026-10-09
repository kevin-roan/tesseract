#!/usr/bin/env bash
# Sets up a Mac from scratch: system settings (root), Homebrew, Node, OrbStack, Tailscale,
# then the Tesseract CLI + sandbox server (./setup-server.sh) and the macOS desktop app
# (Tesseract.app in /Applications, plus the .dmg in apps/electron/dist).
# Asks for the admin password once and keeps sudo alive while it runs; the user-level
# steps (Homebrew, ~/.tesseract, the launchd agent) run as you, never as root.
# Run it as `./setup-mac.sh` (or `sudo ./setup-mac.sh`; it drops back to your user).
# Re-run after `git pull` to update. Runbook: docs/runbooks/mac-server.md
# Written for the bash 3.2 that ships with macOS.
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly REPO_ROOT
readonly SELF="${REPO_ROOT}/setup-mac.sh"
readonly ELECTRON_DIR="${REPO_ROOT}/apps/electron"
readonly APP_NAME="Tesseract"
readonly APP_DEST="/Applications/${APP_NAME}.app"
readonly PROFILE_MARKER="# homebrew (setup-mac.sh)"

usage() {
  cat << 'EOF'
Usage: ./setup-mac.sh [options]

Sets up everything Tesseract needs on this Mac, then builds and installs the app:

  1. root: never sleep, power back on after a power cut (pmset)
  2. Homebrew (with the Xcode Command Line Tools), node, git, rsync
  3. OrbStack (Docker) and the Tailscale app, unless Docker/Tailscale are already installed
  4. ./setup-server.sh: tesseract CLI in ~/.tesseract/bin, sandbox image, host shell service
  5. the macOS build: apps/electron/dist/Tesseract-<version>-universal.dmg,
     installed as /Applications/Tesseract.app

Options:
  --skip-server       skip step 4 (no sandbox / host shell on this Mac)
  --skip-app          skip step 5 (no desktop app build)
  --keep-sleep        leave the power settings alone (e.g. on a laptop)
  --hostname NAME     passed to setup-server.sh (sandbox tailnet name, default: tesseract)
  --with LIST         passed to setup-server.sh (sandbox components)
  --rebuild           passed to setup-server.sh (rebuild the sandbox image)
  --yes               passed to setup-server.sh (don't stop to ask)
  -h, --help          show this help

Secrets (TS_AUTHKEY, CLAUDE_CODE_OAUTH_TOKEN, TS_TAILNET_DOMAIN) are read from the
environment or asked for by setup-server.sh. `sudo` clears the environment, so either
run ./setup-mac.sh without sudo or paste them when asked.

Signing: with a "Developer ID Application" identity in the keychain (or CSC_LINK) the app
is signed; otherwise it is ad-hoc signed, which is fine for this Mac only.
EOF
}

step() { printf '\n==> %s\n' "$*"; }
info() { printf '    %s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die() {
  printf 'setup-mac: %s\n' "$*" >&2
  exit 1
}

for arg in "$@"; do
  case "${arg}" in
    -h | --help)
      usage
      exit 0
      ;;
  esac
done

[[ "$(uname -s)" == Darwin ]] || die "this script is for macOS; on Linux use ./setup-server.sh"

# Started with sudo: continue as the real user. sudo keeps that user's ticket, so the
# `sudo` calls below don't ask for the password again.
if [[ "$(id -u)" == 0 ]]; then
  [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != root ]] || die "run this from your own account (./setup-mac.sh), not as root"
  exec sudo -u "${SUDO_USER}" -H /bin/bash "${SELF}" "$@"
fi

skip_server=""
skip_app=""
keep_sleep=""
server_args=()

while (($# > 0)); do
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    --skip-server)
      skip_server=1
      shift
      ;;
    --skip-app)
      skip_app=1
      shift
      ;;
    --keep-sleep)
      keep_sleep=1
      shift
      ;;
    --hostname | --with)
      (($# >= 2)) || die "$1 needs a value"
      server_args+=("$1" "$2")
      shift 2
      ;;
    --hostname=* | --with=* | --rebuild | --yes | -y)
      server_args+=("$1")
      shift
      ;;
    *) die "unknown argument: $1 (see --help)" ;;
  esac
done

case "$(uname -m)" in
  arm64) brew_prefix=/opt/homebrew ;;
  x86_64) brew_prefix=/usr/local ;;
  *) die "unsupported CPU: $(uname -m)" ;;
esac

step "Administrator access"
info "macOS asks for your password once; sudo is kept alive until the script ends"
sudo -v || die "this script needs an administrator account"
(
  while kill -0 "$$" 2> /dev/null; do
    sudo -n true 2> /dev/null || exit
    sleep 50
  done
) &
sudo_keepalive=$!
trap 'kill "${sudo_keepalive}" 2> /dev/null || true' EXIT

step "Power settings (root)"
if [[ -n "${keep_sleep}" ]]; then
  info "skipped (--keep-sleep)"
else
  sudo pmset -a sleep 0 disksleep 0 autorestart 1
  info "never sleeps, powers back on after a power cut (undo: sudo pmset -a sleep 1 disksleep 10 autorestart 0)"
fi

step "Homebrew"
export PATH="${brew_prefix}/bin:${brew_prefix}/sbin:${PATH}"
if ! command -v brew > /dev/null; then
  info "installing Homebrew (also installs the Xcode Command Line Tools)"
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  command -v brew > /dev/null || die "Homebrew install failed; see https://brew.sh"
fi
eval "$(brew shellenv)"
if ! grep -qF "${PROFILE_MARKER}" "${HOME}/.zprofile" 2> /dev/null && ! grep -qF "brew shellenv" "${HOME}/.zprofile" 2> /dev/null; then
  printf '\n%s\neval "$(%s/bin/brew shellenv)"\n' "${PROFILE_MARKER}" "${brew_prefix}" >> "${HOME}/.zprofile"
  info "added Homebrew to ~/.zprofile"
fi
xcode-select -p > /dev/null 2>&1 || die "the Xcode Command Line Tools are missing; run: xcode-select --install, then re-run"
info "$(brew --version | head -n 1)"

step "Command line tools"
# node runs the electron packaging scripts (TypeScript type stripping needs Node 22.18+).
brew install git rsync node
info "node $(node --version)"
# bun builds the CLI and the app; setup-server.sh would install it too, but only in its own shell.
export PATH="${HOME}/.bun/bin:${PATH}"
if ! command -v bun > /dev/null; then
  info "installing bun into ~/.bun"
  curl -fsSL https://bun.sh/install | bash > /dev/null
  command -v bun > /dev/null || die "bun install failed; see https://bun.sh"
fi
info "bun $(bun --version)"

step "Docker"
if command -v docker > /dev/null || [[ -d /Applications/OrbStack.app || -d /Applications/Docker.app ]]; then
  info "already installed"
else
  info "installing OrbStack"
  brew install --cask orbstack
fi
export PATH="${HOME}/.orbstack/bin:/Applications/Docker.app/Contents/Resources/bin:${PATH}"
if ! docker info > /dev/null 2>&1; then
  info "starting the Docker engine"
  open -ga OrbStack 2> /dev/null || open -ga Docker 2> /dev/null || true
  for _ in $(seq 1 90); do
    docker info > /dev/null 2>&1 && break
    sleep 2
  done
fi
if ! docker info > /dev/null 2>&1; then
  if [[ -t 0 ]]; then
    printf '    Finish the OrbStack/Docker first-run window (accept, allow the helper), then press Enter: '
    read -r _
  fi
  docker info > /dev/null 2>&1 || die "the Docker engine isn't running; open OrbStack (or Docker Desktop) and re-run"
fi
info "docker $(docker version --format '{{.Server.Version}}' 2> /dev/null || echo '?')"
info "turn on \"Start at login\" in OrbStack/Docker Desktop settings so the sandbox comes back after a reboot"

step "Tailscale"
tailscale_cli=/Applications/Tailscale.app/Contents/MacOS/Tailscale
if [[ ! -x "${tailscale_cli}" ]] && ! command -v tailscale > /dev/null; then
  info "installing the Tailscale app"
  brew install --cask tailscale-app 2> /dev/null || brew install --cask tailscale
fi
[[ -x "${tailscale_cli}" ]] || tailscale_cli="$(command -v tailscale)"
if ! "${tailscale_cli}" ip -4 > /dev/null 2>&1; then
  open -a Tailscale 2> /dev/null || true
  [[ -t 0 ]] || die "Tailscale isn't signed in; open Tailscale, sign in and re-run"
  printf '    Sign in to Tailscale in the menu bar app (allow the VPN configuration), then press Enter: '
  read -r _
  for _ in $(seq 1 30); do
    "${tailscale_cli}" ip -4 > /dev/null 2>&1 && break
    sleep 2
  done
  "${tailscale_cli}" ip -4 > /dev/null 2>&1 || die "Tailscale still isn't connected; sign in and re-run"
fi
info "tailscale $("${tailscale_cli}" ip -4 | head -n 1)"
info "in the Tailscale admin console, turn on MagicDNS and HTTPS certificates (DNS page)"

if [[ -n "${skip_server}" ]]; then
  step "Tesseract server: skipped (--skip-server)"
else
  step "Tesseract CLI, sandbox and host shell (setup-server.sh)"
  "${REPO_ROOT}/setup-server.sh" ${server_args[@]+"${server_args[@]}"}
fi

if [[ -n "${skip_app}" ]]; then
  step "Desktop app: skipped (--skip-app)"
else
  step "Building the macOS app"
  (cd "${REPO_ROOT}" && ELECTRON_SKIP_BINARY_DOWNLOAD=1 bun install --frozen-lockfile)
  # Without a signing identity electron-builder skips signing; don't fail on that.
  if ! security find-identity -v -p codesigning 2> /dev/null | grep -q "Developer ID Application" && [[ -z "${CSC_LINK:-}" ]]; then
    export CSC_IDENTITY_AUTO_DISCOVERY=false
    info "no Developer ID identity: building unsigned, ad-hoc signing below"
  fi
  (cd "${REPO_ROOT}" && bun run electron:dist)

  built_app=""
  for dir in mac-universal mac-arm64 mac; do
    if [[ -d "${ELECTRON_DIR}/dist/${dir}/${APP_NAME}.app" ]]; then
      built_app="${ELECTRON_DIR}/dist/${dir}/${APP_NAME}.app"
      break
    fi
  done
  [[ -n "${built_app}" ]] || die "electron-builder produced no ${APP_NAME}.app under apps/electron/dist"
  version="$(node -p 'require(process.argv[1]).version' "${ELECTRON_DIR}/package.json")"
  dmg=""
  for file in "${ELECTRON_DIR}/dist/${APP_NAME}-${version}"-*.dmg; do
    [[ -f "${file}" ]] && dmg=${file}
  done

  step "Installing ${APP_DEST}"
  if pgrep -xq "${APP_NAME}"; then
    osascript -e "tell application \"${APP_NAME}\" to quit" > /dev/null 2>&1 || true
    sleep 2
  fi
  sudo rm -rf "${APP_DEST}"
  sudo ditto "${built_app}" "${APP_DEST}"
  # Owned by you, so in-app updates can replace it without a password.
  sudo chown -R "$(id -un):admin" "${APP_DEST}"
  xattr -dr com.apple.quarantine "${APP_DEST}" 2> /dev/null || true
  if ! codesign --verify --deep --strict "${APP_DEST}" > /dev/null 2>&1; then
    info "ad-hoc signing (runs on this Mac only)"
    codesign --force --deep --sign - "${APP_DEST}"
  fi
  info "installed ${APP_NAME} ${version}"
  [[ -z "${dmg}" ]] || info "installer for other Macs: ${dmg}"
fi

step "All set"
cat << EOF
    Open a new terminal (to pick up PATH), then:
      tesseract --version
      tesseract server status     sandbox, host shell and tailscale serve
      tesseract server pair       pairing QR codes for the phone
EOF
[[ -n "${skip_app}" ]] || printf '      open -a %s            the desktop app\n' "${APP_NAME}"
cat << EOF

    Also do once, by hand: System Settings > Users & Groups > Automatically log in as $(id -un)
    (needs FileVault off), so Docker and the host shell start after a reboot.
    Update later with: git pull && ./setup-mac.sh
EOF
