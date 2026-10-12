#!/bin/bash
# Sets up Tesseract on a Mac end to end: Homebrew tools, the Tesseract VM (Colima profile
# "tesseract" with Sysbox), the sandbox, and server containers. Safe to re-run.
# docs/adr/0012-macos-container-vm.md, docs/runbooks/server-containers.md (macOS).
#
#   scripts/setup-mac.sh [--yes] [--skip-sandbox] [--skip-containers]
#
# Optional input (otherwise you are asked, Enter skips):
#   TAILSCALE_KEY_FILE   file holding a tagged, pre-approved Tailscale auth key for server containers
#   CLOUDFLARE_TOKEN_FILE  file holding the Cloudflare API token for public URLs

set -euo pipefail

PROFILE="tesseract"
CONTEXT="colima-${PROFILE}"
APP_ID="dev.tesseract.Desktop"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP=""
RESOURCES=""
TESSERACT_BIN=""
COLIMA_DIR="${COLIMA_HOME:-${HOME}/.colima}"
CONFIG="${COLIMA_DIR}/${PROFILE}/colima.yaml"
DOCKER_CONFIG_FILE="${DOCKER_CONFIG:-${HOME}/.docker}/config.json"
MARKER="tesseract-managed"
LOG="${HOME}/Library/Logs/tesseract-setup-mac.log"
FORMULAE="colima docker docker-compose docker-buildx jq"

ASSUME_YES=0
SKIP_SANDBOX=0
SKIP_CONTAINERS=0
for arg in "$@"; do
  case "$arg" in
    --yes|-y) ASSUME_YES=1 ;;
    --skip-sandbox) SKIP_SANDBOX=1 ;;
    --skip-containers) SKIP_CONTAINERS=1 ;;
    -h|--help) sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
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

colima_yaml() {
  cat <<'COLIMA_YAML'
# Written by Tesseract. Colima drops comments when it rewrites this file; Tesseract recognises it by the tesseract-managed marker in the provision script. Remove that marker to keep your own edits.
cpu: 6
disk: 120
memory: 5
arch: aarch64
runtime: docker
hostname: null
kubernetes:
  enabled: false
autoActivate: true
network:
  address: false
  mode: shared
  interface: en0
  preferredRoute: false
  dns: []
  dnsHosts:
    host.docker.internal: host.lima.internal
  hostAddresses: false
  gatewayAddress: 192.168.5.2
forwardAgent: false
docker:
  runtimes:
    sysbox-runc:
      path: /usr/bin/sysbox-runc
vmType: vz
portForwarder: ssh
rosetta: true
binfmt: true
nestedVirtualization: false
mountType: virtiofs
mountInotify: false
provision:
  - mode: system
    script: |
      #!/bin/sh
      # tesseract-managed: installs sysbox-ce 0.7.1 for the sysbox-runc docker runtime (provision 2)
      set -eu
      use_public_dns() {
        rm -f /etc/resolv.conf
        printf 'nameserver 1.1.1.1\nnameserver 8.8.8.8\n' > /etc/resolv.conf
      }
      if ! grep -qs '^nameserver' /etc/resolv.conf; then
        use_public_dns
      fi
      sysbox_active() {
        systemctl is-active --quiet sysbox-mgr && systemctl is-active --quiet sysbox-fs
      }
      if [ -x /usr/bin/sysbox-runc ] && sysbox_active; then
        exit 0
      fi
      if [ ! -x /usr/bin/sysbox-runc ]; then
        case "$(dpkg --print-architecture)" in
        arm64) url="https://downloads.nestybox.com/sysbox/releases/v0.7.1/sysbox-ce_0.7.1-0.linux_arm64.deb"; sum="04ca894ae0b53f0fa54eaacc173ce40363c9a95ea5450f773716a84ef650a69b"; deb="/var/cache/tesseract/sysbox-ce_0.7.1-0.linux_arm64.deb" ;;
        amd64) url="https://downloads.nestybox.com/sysbox/releases/v0.7.1/sysbox-ce_0.7.1-0.linux_amd64.deb"; sum="9d6d5484f980d0a17f86c492c1262015c2afb66280bdb97215b79fde6a0261c5"; deb="/var/cache/tesseract/sysbox-ce_0.7.1-0.linux_amd64.deb" ;;
        *) echo "tesseract: no sysbox-ce package for $(dpkg --print-architecture)" >&2; exit 1 ;;
        esac
        n=0
        until getent hosts downloads.nestybox.com >/dev/null 2>&1; do
          n=$((n + 1))
          if [ "$n" -eq 15 ]; then use_public_dns; fi
          if [ "$n" -ge 60 ]; then echo "tesseract: can't resolve downloads.nestybox.com" >&2; exit 1; fi
          sleep 2
        done
        export DEBIAN_FRONTEND=noninteractive
        n=0
        until apt-get update; do
          n=$((n + 1))
          if [ "$n" -ge 3 ]; then exit 1; fi
          sleep 5
        done
        command -v curl >/dev/null 2>&1 || apt-get install -y curl
        mkdir -p /var/cache/tesseract
        if ! echo "$sum  $deb" | sha256sum -c - >/dev/null 2>&1; then
          curl -fsSL --retry 5 --retry-connrefused --retry-delay 2 -o "$deb.part" "$url"
          echo "$sum  $deb.part" | sha256sum -c -
          mv "$deb.part" "$deb"
        fi
        apt-get install -y "$deb"
      fi
      systemctl enable --now sysbox-mgr sysbox-fs
sshConfig: false
mounts:
  - location: "__TESSERACT_HOME__"
    writable: true
  - location: "__TESSERACT_RESOURCES__"
    writable: false
env: {}
COLIMA_YAML
}

render_config() {
  local yaml
  yaml="$(colima_yaml)"
  case "$RESOURCES/" in
    "$HOME"/*) yaml="$(printf '%s\n' "$yaml" | awk '/__TESSERACT_RESOURCES__/ {skip=2} skip > 0 {skip--; next} {print}')" ;;
  esac
  if [ "$(uname -m)" != "arm64" ]; then
    yaml="$(printf '%s\n' "$yaml" | sed -e 's/^arch: aarch64$/arch: x86_64/' -e 's/^rosetta: true$/rosetta: false/')"
  fi
  printf '%s\n' "$yaml" | sed -e "s|__TESSERACT_HOME__|${HOME}|" -e "s|__TESSERACT_RESOURCES__|${RESOURCES}|"
}

provision_script() {
  colima_yaml | awk '/^    script: \|$/ {on=1; next} /^[^ ]/ {on=0} on {sub(/^      /, ""); print}'
}

vm_status() {
  { colima list --json 2>/dev/null || true; } | jq -r --arg p "$PROFILE" 'select(.name == $p) | .status' 2>/dev/null | head -n1 || true
}

sysbox_ready() {
  docker --context "$CONTEXT" info --format '{{json .Runtimes}}' 2>/dev/null | grep -q '"sysbox-runc"' || return 1
  local services
  services="$(colima ssh -p "$PROFILE" -- systemctl is-active sysbox-mgr sysbox-fs 2>/dev/null || true)"
  [ "$(printf '%s\n' "$services" | grep -cx active)" = 2 ]
}

wait_for_sysbox() {
  local deadline=$((SECONDS + $1))
  while [ "$SECONDS" -lt "$deadline" ]; do
    sysbox_ready && return 0
    sleep 3
  done
  return 1
}

app_of() {
  case "$1" in
    */Contents/Resources/bin/tesseract) printf '%s\n' "${1%/Contents/Resources/bin/tesseract}" ;;
  esac
}

find_install() {
  local on_path real candidate
  on_path="$(command -v tesseract || true)"
  if [ -n "$on_path" ]; then
    real="$(realpath "$on_path" 2>/dev/null || printf '%s' "$on_path")"
    APP="$(app_of "$real")"
  fi
  for candidate in /Applications/Tesseract.app "${HOME}/Applications/Tesseract.app"; do
    if [ -z "$APP" ] && [ -d "$candidate" ]; then APP="$candidate"; fi
  done
  if [ -z "$APP" ]; then
    APP="$(mdfind "kMDItemCFBundleIdentifier == '${APP_ID}'" 2>/dev/null | grep '\.app$' | head -n1 || true)"
  fi
  if [ -n "$APP" ] && [ -d "${APP}/Contents/Resources/sandbox" ]; then
    RESOURCES="${APP}/Contents/Resources/sandbox"
    TESSERACT_BIN="${on_path:-${APP}/Contents/Resources/bin/tesseract}"
    if [ -n "$on_path" ] && [ -z "$(app_of "$real")" ]; then TESSERACT_BIN="${APP}/Contents/Resources/bin/tesseract"; fi
    return 0
  fi
  APP=""
  if [ -d "${REPO_ROOT}/infra/compose" ] && [ -n "$on_path" ]; then
    RESOURCES="$REPO_ROOT"
    TESSERACT_BIN="$on_path"
    return 0
  fi
  return 1
}

docker_desktop_running() {
  pgrep -x "Docker Desktop" >/dev/null 2>&1 || pgrep -x com.docker.backend >/dev/null 2>&1
}

# ---------------------------------------------------------------------------

step "Checking this Mac"
[ "$(uname -s)" = "Darwin" ] || die "This script is for macOS. On Linux, install Sysbox instead (docs/runbooks/server-containers.md)."
[ "$(id -u)" != 0 ] || die "Run it as your normal user, not with sudo."
macos="$(sw_vers -productVersion)"
[ "${macos%%.*}" -ge 13 ] || die "macOS 13 or newer is needed for the VM (found ${macos})."
find_install || die "Tesseract not found. Install the app (drag it to Applications), or run this from a repo checkout with the tesseract command on PATH."
export TESSERACT_SANDBOX_CONTEXT="$RESOURCES"
if [ -n "$APP" ]; then
  ok "macOS ${macos} on $(uname -m), Tesseract app at ${APP}"
else
  ok "macOS ${macos} on $(uname -m), no installed app; using the repo checkout ${REPO_ROOT}"
fi
ok "tesseract command: ${TESSERACT_BIN}"
free_gb=$(( $(df -k "$HOME" | awk 'NR == 2 {print $4}') / 1024 / 1024 ))
if [ "$free_gb" -lt 20 ]; then
  die "Only ${free_gb} GB free on this Mac. The VM disk grows into free space and the sandbox build needs about 40 GB; free some space first (Docker Desktop's data lives in ~/Library/Containers/com.docker.docker)."
fi
[ "$free_gb" -ge 50 ] || warn "Only ${free_gb} GB free; the sandbox build needs about 40 GB."
mem_gb=$(( $(sysctl -n hw.memsize) / 1024 / 1024 / 1024 ))
[ "$mem_gb" -ge 8 ] || warn "Only ${mem_gb} GB of RAM; the VM takes 5 GB."

step "Homebrew"
brew_bin="$(command -v brew || true)"
for candidate in /opt/homebrew/bin/brew /usr/local/bin/brew; do
  if [ -z "$brew_bin" ] && [ -x "$candidate" ]; then brew_bin="$candidate"; fi
done
if [ -z "$brew_bin" ]; then
  confirm "Homebrew is not installed. Install it now (asks for your password)?" || die "Homebrew is required."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" </dev/tty
  for candidate in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    if [ -x "$candidate" ]; then brew_bin="$candidate"; break; fi
  done
  [ -n "$brew_bin" ] || die "Homebrew install did not finish."
fi
eval "$("$brew_bin" shellenv)"
ok "Homebrew at $(brew --prefix)"

step "Installing tools (${FORMULAE})"
missing=""
for formula in $FORMULAE; do
  brew list --formula "$formula" >/dev/null 2>&1 || missing="${missing} ${formula}"
done
if [ -n "$missing" ]; then
  # shellcheck disable=SC2086
  brew install $missing
fi
hash -r
ok "colima $(colima version 2>/dev/null | head -n1 | awk '{print $NF}'), $(docker --version)"

step "Docker CLI plugins (compose, buildx)"
plugins_dir="$(brew --prefix)/lib/docker/cli-plugins"
mkdir -p "$(dirname "$DOCKER_CONFIG_FILE")"
[ -s "$DOCKER_CONFIG_FILE" ] || echo '{}' >"$DOCKER_CONFIG_FILE"
if jq -e --arg d "$plugins_dir" '(.cliPluginsExtraDirs // []) | index($d)' "$DOCKER_CONFIG_FILE" >/dev/null 2>&1; then
  ok "already configured"
else
  cp "$DOCKER_CONFIG_FILE" "${DOCKER_CONFIG_FILE}.bak"
  tmp="$(mktemp)"
  jq --arg d "$plugins_dir" '.cliPluginsExtraDirs = ((.cliPluginsExtraDirs // []) + [$d] | unique)' "$DOCKER_CONFIG_FILE" >"$tmp"
  mv "$tmp" "$DOCKER_CONFIG_FILE"
  ok "added ${plugins_dir} (backup: ${DOCKER_CONFIG_FILE}.bak)"
fi
if [ "$(jq -r '.credsStore // ""' "$DOCKER_CONFIG_FILE")" = "desktop" ]; then
  cp "$DOCKER_CONFIG_FILE" "${DOCKER_CONFIG_FILE}.bak"
  tmp="$(mktemp)"
  jq 'del(.credsStore)' "$DOCKER_CONFIG_FILE" >"$tmp"
  mv "$tmp" "$DOCKER_CONFIG_FILE"
  ok "removed Docker Desktop's credential helper (it needs the keychain and Docker Desktop)"
fi
if [ "$(jq -r '.credsStore // ""' "$DOCKER_CONFIG_FILE")" = "osxkeychain" ] && [ -n "${SSH_CONNECTION:-}" ]; then
  warn "credsStore is osxkeychain; over SSH the keychain may be locked and pulls fail. Unlock it: security -v unlock-keychain ~/Library/Keychains/login.keychain-db"
fi
docker compose version >/dev/null 2>&1 || die "docker compose is not working."
docker buildx version >/dev/null 2>&1 || die "docker buildx is not working."
compose_version="$(docker compose version --short 2>/dev/null || true)"
case "$compose_version" in
  [0-9]*) ok "compose ${compose_version}" ;;
  *)
    warn "docker compose reports version \"${compose_version}\"; upgrading it"
    brew upgrade docker-compose || true
    compose_version="$(docker compose version --short 2>/dev/null || true)"
    case "$compose_version" in
      [0-9]*) ok "compose ${compose_version}" ;;
      *) warn "compose still reports \"${compose_version}\"; Tesseract 0.1.x treats that as too old (newer builds accept it)" ;;
    esac
    ;;
esac

step "Docker Desktop"
if docker_desktop_running; then
  if confirm "Docker Desktop is running and two VMs don't fit in this Mac's RAM. Quit it?"; then
    osascript -e 'quit app "Docker"' >/dev/null 2>&1 || true
    for _ in $(seq 1 30); do docker_desktop_running || break; sleep 2; done
    if docker_desktop_running; then die "Docker Desktop is still running; quit it from its menu and re-run."; fi
    ok "Docker Desktop quit"
  else
    warn "Leaving Docker Desktop running; expect heavy swapping."
  fi
else
  ok "not running"
fi
osascript -e 'tell application "System Events" to delete login item "Docker"' >/dev/null 2>&1 || true
for settings in "${HOME}/Library/Group Containers/group.com.docker/settings-store.json" "${HOME}/Library/Group Containers/group.com.docker/settings.json"; do
  [ -f "$settings" ] || continue
  key="AutoStart"
  if [ "${settings##*/}" = "settings.json" ]; then key="autoStart"; fi
  tmp="$(mktemp)"
  if jq --arg k "$key" '.[$k] = false' "$settings" >"$tmp" 2>/dev/null; then
    mv "$tmp" "$settings"
  else
    rm -f "$tmp"
  fi
done
ok "Docker Desktop won't start at login"

step "Tesseract VM config (${CONFIG})"
mkdir -p "$(dirname "$CONFIG")"
wanted="$(render_config)"
changed=0
if [ ! -f "$CONFIG" ]; then
  printf '%s\n' "$wanted" >"$CONFIG"
  changed=1
  ok "written"
elif grep -q "$MARKER" "$CONFIG"; then
  current_size="$(grep -E '^(cpu|memory|disk):' "$CONFIG" | sort)"
  wanted_size="$(printf '%s\n' "$wanted" | grep -E '^(cpu|memory|disk):' | sort)"
  provision_line="$(printf '%s\n' "$wanted" | grep -m1 "${MARKER}: installs" | sed 's/^ *//')"
  if [ "$current_size" != "$wanted_size" ] || ! grep -q "sysbox-runc" "$CONFIG" || ! grep -q "^sshConfig: false" "$CONFIG" || ! grep -qF "$provision_line" "$CONFIG"; then
    cp "$CONFIG" "${CONFIG}.bak"
    printf '%s\n' "$wanted" >"$CONFIG"
    changed=1
    ok "updated (backup: ${CONFIG}.bak)"
  else
    ok "already current"
  fi
else
  warn "${CONFIG} exists without the ${MARKER} marker (your own edits)."
  confirm "Replace it with Tesseract's config (a backup is kept)?" || die "Left your config alone."
  cp "$CONFIG" "${CONFIG}.bak"
  printf '%s\n' "$wanted" >"$CONFIG"
  changed=1
  ok "replaced (backup: ${CONFIG}.bak)"
fi

step "Starting the Tesseract VM (first start downloads an image, ~5 min)"
status="$(vm_status)"
if [ "$status" = "Broken" ]; then
  warn "VM is broken; force-stopping it"
  colima stop -f "$PROFILE" || true
  status="Stopped"
fi
if [ "$status" = "Running" ] && [ "$changed" = 1 ]; then
  warn "Config changed; restarting the VM"
  colima stop "$PROFILE"
  status="Stopped"
fi
socket="${COLIMA_DIR}/${PROFILE}/docker.sock"
if [ "$status" = "Running" ] && [ ! -S "$socket" ]; then
  warn "VM reports running but ${socket} is missing; restarting it"
  colima stop -f "$PROFILE" || true
  status="Stopped"
fi
if [ "$status" != "Running" ]; then
  colima start "$PROFILE"
fi
if ! docker context inspect "$CONTEXT" >/dev/null 2>&1; then
  warn "Docker context ${CONTEXT} is missing; creating it"
  docker context create "$CONTEXT" --docker "host=unix://${socket}" >/dev/null
fi
docker context use "$CONTEXT" >/dev/null
ok "VM running, docker context ${CONTEXT}"

step "Sysbox"
if ! wait_for_sysbox 30; then
  warn "Sysbox isn't active yet; running the provision script"
  provision_script | colima ssh -p "$PROFILE" -- sudo sh -s
  wait_for_sysbox 300 || die "Sysbox did not start. Check: colima ssh -p ${PROFILE} -- systemctl status sysbox-mgr sysbox-fs"
fi
docker run --rm --runtime sysbox-runc busybox true || die "A test container under sysbox-runc failed."
ok "sysbox-mgr and sysbox-fs active, sysbox-runc works"

step "Tesseract command"
tesseract_bin="$TESSERACT_BIN"
[ -x "$tesseract_bin" ] || die "tesseract command not found (${tesseract_bin})."
if ! command -v tesseract >/dev/null 2>&1; then
  warn "tesseract is not on PATH; using ${tesseract_bin}. Add it with the app menu: Install 'tesseract' Command…"
fi
ok "$("$tesseract_bin" version 2>/dev/null || echo "$tesseract_bin")"

if [ "$SKIP_SANDBOX" = 0 ]; then
  step "Sandbox (builds the image in the VM; takes a while)"
  "$tesseract_bin" sandbox build
  "$tesseract_bin" sandbox status || true
  step "Pair your phone"
  echo "Docker Desktop's volumes don't carry over, so the sandbox is a new tailnet node."
  echo "Delete the old sandbox machine in the Tailscale admin console, then scan this:"
  "$tesseract_bin" sandbox pair || warn "Pairing failed; run: tesseract sandbox pair"
fi

read_secret() {
  local file="$1" prompt="$2" value=""
  if [ -n "$file" ]; then
    [ -f "$file" ] || die "${file} not found."
    value="$(tr -d '\r\n' <"$file")"
  elif [ "$ASSUME_YES" = 0 ]; then
    read -r -s -p "$prompt" value </dev/tty || true
    echo
  fi
  printf '%s' "$value"
}

if [ "$SKIP_CONTAINERS" = 0 ]; then
  step "Server containers"
  ts_key="$(read_secret "${TAILSCALE_KEY_FILE:-}" "Tailscale auth key for server containers (Enter to keep the saved one): ")"
  if [ -n "$ts_key" ]; then
    printf '%s' "$ts_key" | "$tesseract_bin" containers tailscale-key
  fi
  cf_token="$(read_secret "${CLOUDFLARE_TOKEN_FILE:-}" "Cloudflare API token (Enter to keep the saved one): ")"
  if [ -n "$cf_token" ]; then
    printf '%s' "$cf_token" | "$tesseract_bin" domains login
  fi
  unset ts_key cf_token
  "$tesseract_bin" containers build
  "$tesseract_bin" containers doctor || true
fi

step "Done"
colima list
echo
echo "Daily use on 8 GB: one heavy job at a time."
echo "  tesseract containers stop <name>   before Android builds"
echo "  colima stop ${PROFILE}             frees all of the VM's memory"
echo "Log: ${LOG}"
