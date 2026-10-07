#!/usr/bin/env bash
# Sets up the headless Tesseract server (sandbox stack + host shell) on this machine.
# Clone the repo on the server (a Mac; Linux works too), then run ./setup-server.sh.
# Re-run it after `git pull` to update. Never runs sudo itself: commands that need
# root are printed for you to run. Runbook: docs/runbooks/mac-server.md
# Written for the bash 3.2 that ships with macOS.
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly REPO_ROOT
readonly ELECTRON_DIR="${REPO_ROOT}/apps/electron"
readonly BUNDLE_DIR="${ELECTRON_DIR}/build/sandbox-context"
readonly INSTALL_ROOT="${HOME}/.tesseract"
readonly BIN_DIR="${INSTALL_ROOT}/bin"
readonly SANDBOX_DIR="${INSTALL_ROOT}/sandbox"
readonly IMAGE_STAMP="${INSTALL_ROOT}/image.sha256"
readonly IMAGE="theone/sandbox:latest"
readonly TAILSCALE_VOLUME="theone-tailscale"
readonly PROFILE_MARKER="# tesseract (setup-server.sh)"
readonly AUTHKEY_URL="https://login.tailscale.com/admin/settings/keys"

usage() {
  cat << 'EOF'
Usage: ./setup-server.sh [--hostname NAME] [--with COMPONENTS] [--rebuild] [--yes]

Sets up this machine as the Tesseract server: builds the `tesseract` and
`theone-controller` binaries into ~/.tesseract/bin, builds the sandbox image,
starts the sandbox on your tailnet and installs the host shell as a login service
(launchd on macOS, systemd --user on Linux). Safe to re-run; re-run after
`git pull` to update.

  --hostname NAME     tailnet name of the sandbox (default: tesseract)
  --with LIST         sandbox components: android,flutter,mono,whisper | all | none
                      (default: all on x86_64, flutter,whisper on Apple silicon)
  --rebuild           rebuild the sandbox image even if nothing changed
  --yes               don't stop to ask; fail if a secret or root step is missing
  -h, --help          show this help

Secrets are taken from the environment when set, otherwise asked for (hidden):
  TS_AUTHKEY               tailscale auth key for the sandbox (first install only)
  CLAUDE_CODE_OAUTH_TOKEN  from `claude setup-token` (the sandbox can't read the macOS keychain)
  TS_TAILNET_DOMAIN        detected from `tailscale status` when not set
EOF
}

step() { printf '\n==> %s\n' "$*"; }
info() { printf '    %s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die() {
  printf 'setup-server: %s\n' "$*" >&2
  exit 1
}

hostname_arg="tesseract"
components=""
rebuild=""
assume_yes=""

while (($# > 0)); do
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    --hostname)
      (($# >= 2)) || die "--hostname needs a value"
      hostname_arg=$2
      shift 2
      ;;
    --hostname=*)
      hostname_arg=${1#--hostname=}
      shift
      ;;
    --with)
      (($# >= 2)) || die "--with needs a value"
      components=$2
      shift 2
      ;;
    --with=*)
      components=${1#--with=}
      shift
      ;;
    --rebuild)
      rebuild=1
      shift
      ;;
    --yes | -y)
      assume_yes=1
      shift
      ;;
    *) die "unknown argument: $1 (see --help)" ;;
  esac
done

interactive() { [[ -z "${assume_yes}" && -t 0 ]]; }

[[ "$(id -u)" != 0 ]] || die "run this as your normal user, not root; it prints the few commands that need sudo"

os="$(uname -s)"
case "${os}" in
  Darwin) os_name=mac ;;
  Linux) os_name=linux ;;
  *) die "unsupported OS: ${os}" ;;
esac
case "$(uname -m)" in
  arm64 | aarch64) arch=arm64 ;;
  x86_64 | amd64) arch=x64 ;;
  *) die "unsupported CPU: $(uname -m)" ;;
esac
target="${os_name}-${arch}"
if [[ -z "${components}" ]]; then
  if [[ "${arch}" == arm64 ]]; then components="flutter,whisper"; else components="all"; fi
fi

# launchd, ssh and Finder start with a minimal PATH; add where the tools usually live.
export PATH="${BIN_DIR}:${HOME}/.bun/bin:/opt/homebrew/bin:/usr/local/bin:${HOME}/.orbstack/bin:/Applications/Docker.app/Contents/Resources/bin:/Applications/Tailscale.app/Contents/MacOS:${PATH}"

step "Checking prerequisites (${target})"

for tool in git curl rsync; do
  command -v "${tool}" > /dev/null || die "${tool} not found; install it and re-run"
done

if ! command -v bun > /dev/null; then
  info "installing bun into ~/.bun (no root needed)"
  curl -fsSL https://bun.sh/install | bash > /dev/null
  command -v bun > /dev/null || die "bun install failed; see https://bun.sh"
fi
info "bun $(bun --version)"

if ! command -v docker > /dev/null; then
  if [[ "${os_name}" == mac ]]; then
    die "docker not found. Install OrbStack (recommended for a headless Mac) or Docker Desktop, open it once, then re-run:
    brew install --cask orbstack        # or https://orbstack.dev"
  fi
  die "docker not found. Install Docker Engine 24+ (https://docs.docker.com/engine/install/), then re-run"
fi
if ! docker info > /dev/null 2>&1; then
  if [[ "${os_name}" == mac ]]; then
    info "starting the Docker engine"
    open -ga OrbStack 2> /dev/null || open -ga Docker 2> /dev/null || true
    for _ in $(seq 1 60); do
      docker info > /dev/null 2>&1 && break
      sleep 2
    done
  fi
  docker info > /dev/null 2>&1 || die "docker is installed but the engine isn't running (start OrbStack/Docker Desktop, or: sudo systemctl start docker)"
fi
docker buildx version > /dev/null 2>&1 || die "docker buildx is missing (it ships with OrbStack and Docker Desktop; on Linux install docker-buildx-plugin)"
info "docker $(docker version --format '{{.Server.Version}}' 2> /dev/null || echo '?')"

tailscale_bin=""
for candidate in "$(command -v tailscale 2> /dev/null || true)" /Applications/Tailscale.app/Contents/MacOS/Tailscale /opt/homebrew/bin/tailscale /usr/local/bin/tailscale; do
  if [[ -n "${candidate}" && -x "${candidate}" ]]; then
    tailscale_bin=${candidate}
    break
  fi
done
[[ -n "${tailscale_bin}" ]] || die "tailscale not found. Install the Tailscale app (https://tailscale.com/download), sign in, then re-run"
tailscale_ip="$("${tailscale_bin}" ip -4 2> /dev/null | head -n 1 || true)"
[[ -n "${tailscale_ip}" ]] || die "tailscale isn't connected; open Tailscale and sign in, then re-run"
info "tailscale ${tailscale_ip}"

step "Checking settings that need root"

root_commands=()
manual_steps=()
check_root_settings() {
  root_commands=()
  manual_steps=()
  if [[ "${os_name}" == mac ]]; then
    local settings sleep_value restart_value
    settings="$(pmset -g 2> /dev/null || true)"
    sleep_value="$(printf '%s\n' "${settings}" | awk '$1 == "sleep" { print $2; exit }')"
    restart_value="$(printf '%s\n' "${settings}" | awk '$1 == "autorestart" { print $2; exit }')"
    if [[ "${sleep_value}" != 0 ]]; then
      root_commands+=("sudo pmset -a sleep 0 disksleep 0    # never sleep, so the sandbox stays reachable")
    fi
    if [[ -n "${restart_value}" && "${restart_value}" != 1 ]]; then
      root_commands+=("sudo pmset -a autorestart 1          # power back on after a power cut")
    fi
    if ! defaults read /Library/Preferences/com.apple.loginwindow autoLoginUser > /dev/null 2>&1; then
      manual_steps+=("Turn on automatic login: System Settings > Users & Groups > Automatically log in as ${USER}."
        "  Docker and the host shell only start after you log in. FileVault must be off for automatic login.")
    fi
  else
    if [[ "$(loginctl show-user "${USER}" -p Linger --value 2> /dev/null || echo no)" != yes ]]; then
      root_commands+=("sudo loginctl enable-linger ${USER}    # keep the host shell running without a login session")
    fi
    if ! id -nG | tr ' ' '\n' | grep -qx docker && [[ ! -w /var/run/docker.sock ]]; then
      root_commands+=("sudo usermod -aG docker ${USER}        # then log out and back in")
    fi
  fi
}

check_root_settings
if ((${#root_commands[@]} == 0)); then
  info "nothing to do"
else
  printf '\nPlease run these yourself (they need root):\n\n'
  for command in "${root_commands[@]}"; do printf '    %s\n' "${command}"; done
  printf '\n'
  if interactive; then
    read -r -p "Run them in another terminal, then press Enter to continue (or type s to skip): " answer
    if [[ "${answer}" != s ]]; then
      check_root_settings
      ((${#root_commands[@]} == 0)) || warn "some of the commands above still look undone; continuing anyway"
    fi
  else
    warn "continuing without them"
  fi
fi
if ((${#manual_steps[@]} > 0)); then
  printf '\nAlso do this once, by hand:\n'
  for line in "${manual_steps[@]}"; do printf '    %s\n' "${line}"; done
fi

step "Building tesseract and theone-controller"

(cd "${REPO_ROOT}" && ELECTRON_SKIP_BINARY_DOWNLOAD=1 bun install --frozen-lockfile)
(cd "${ELECTRON_DIR}" && bun scripts/cli-build.ts --target "${target}")
(cd "${ELECTRON_DIR}" && bun scripts/bundle-sandbox.ts)

step "Installing into ~/.tesseract"

mkdir -p "${BIN_DIR}" "${SANDBOX_DIR}" "${HOME}/.claude"
for binary in tesseract theone-controller; do
  built="${ELECTRON_DIR}/dist-cli/${target}/${binary}"
  [[ -x "${built}" ]] || die "build produced no ${built}"
  install -m 0755 "${built}" "${BIN_DIR}/${binary}"
done
rsync -a --delete "${BUNDLE_DIR}/" "${SANDBOX_DIR}/"
[[ "${os_name}" != mac ]] || xattr -dr com.apple.quarantine "${BIN_DIR}" 2> /dev/null || true
export MONOLITH_SANDBOX_CONTEXT="${SANDBOX_DIR}"

if [[ "${os_name}" == mac ]]; then profile="${HOME}/.zprofile"; else profile="${HOME}/.profile"; fi
if ! grep -qF "${PROFILE_MARKER}" "${profile}" 2> /dev/null; then
  printf '\n%s\nexport PATH="$HOME/.tesseract/bin:$PATH"\n' "${PROFILE_MARKER}" >> "${profile}"
  info "added ~/.tesseract/bin to PATH in ${profile} (open a new shell to use it)"
fi
info "$("${BIN_DIR}/tesseract" --version)"

step "Secrets"

if [[ -n "${MONOLITH_USER_DATA:-}" ]]; then
  env_file="${MONOLITH_USER_DATA}/sandbox/.env"
elif [[ "${os_name}" == mac ]]; then
  env_file="${HOME}/Library/Application Support/Monolith/sandbox/.env"
else
  env_file="${XDG_CONFIG_HOME:-${HOME}/.config}/Monolith/sandbox/.env"
fi
saved() { [[ -f "${env_file}" ]] && grep -qE "^$1=.+" "${env_file}"; }

ask_secret() {
  local name=$1 prompt=$2 value
  interactive || return 1
  read -r -s -p "${prompt}: " value
  printf '\n'
  [[ -n "${value}" ]] || return 1
  export "${name}=${value}"
}

if [[ -z "${TS_TAILNET_DOMAIN:-}" ]]; then
  TS_TAILNET_DOMAIN="$("${tailscale_bin}" status --json 2> /dev/null | bun -e 'const s = JSON.parse(await Bun.stdin.text()); console.log((s.MagicDNSSuffix ?? s.CurrentTailnet?.MagicDNSSuffix ?? "").replace(/\.$/, ""))' || true)"
  [[ -n "${TS_TAILNET_DOMAIN}" ]] || die "couldn't detect the tailnet domain; set TS_TAILNET_DOMAIN=<tailnet>.ts.net (turn on MagicDNS + HTTPS in the Tailscale admin console)"
  export TS_TAILNET_DOMAIN
fi
info "tailnet ${TS_TAILNET_DOMAIN}"

if [[ -n "${TS_AUTHKEY:-}" ]] || saved TS_AUTHKEY || docker volume inspect "${TAILSCALE_VOLUME}" > /dev/null 2>&1; then
  info "tailscale auth key: not needed (given or sandbox already joined)"
else
  printf '    The sandbox joins your tailnet as its own machine and needs an auth key once.\n'
  printf '    Create one at %s\n' "${AUTHKEY_URL}"
  ask_secret TS_AUTHKEY "    Paste the auth key (hidden)" || die "TS_AUTHKEY is required for the first install"
fi

if [[ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]] || saved CLAUDE_CODE_OAUTH_TOKEN; then
  info "Claude token: set"
else
  printf '    Claude Code inside the sandbox needs a token: run `claude setup-token` on any\n'
  printf '    machine where you are logged in to Claude and paste the token here.\n'
  ask_secret CLAUDE_CODE_OAUTH_TOKEN "    Paste the token (hidden, Enter to skip)" ||
    warn "no Claude token; agents in the sandbox won't be able to sign in until you re-run with CLAUDE_CODE_OAUTH_TOKEN set"
fi

step "Host shell PIN"

pin_set="$("${BIN_DIR}/theone-controller" host pair --json 2> /dev/null | bun -e 'const line = (await Bun.stdin.text()).split("\n").find((l) => l.trim().startsWith("{")); console.log(line && JSON.parse(line).pinSet ? "yes" : "no")' || echo no)"
if [[ "${pin_set}" == yes ]]; then
  info "already set (change it with: theone-controller host pin)"
elif interactive; then
  info "choose a 6-12 digit PIN; the phone asks for it before opening a shell on this machine"
  "${BIN_DIR}/theone-controller" host pin
else
  warn "no host shell PIN yet; set one with: ~/.tesseract/bin/theone-controller host pin"
fi

step "Starting the sandbox and the host shell"

context_hash="$(bun -e 'const m = JSON.parse(await Bun.file(process.argv[1]).text()); console.log(new Bun.CryptoHasher("sha256").update(JSON.stringify(m.files)).digest("hex"))' "${SANDBOX_DIR}/manifest.json")"
install_args=(server install --mode tailscale --hostname "${hostname_arg}" --with "${components}")
if [[ -n "${rebuild}" ]] || ! docker image inspect "${IMAGE}" > /dev/null 2>&1 || [[ "$(cat "${IMAGE_STAMP}" 2> /dev/null || true)" != "${context_hash}" ]]; then
  info "building the sandbox image (${components}); the first build takes a while"
  install_args+=(--build)
fi
"${BIN_DIR}/tesseract" "${install_args[@]}"
printf '%s\n' "${context_hash}" > "${IMAGE_STAMP}"

step "Done"
cat << EOF
    Sandbox:     https://${hostname_arg}.${TS_TAILNET_DOMAIN}
    Host shell:  https://<this machine>.${TS_TAILNET_DOMAIN}:8443

    tesseract server pair      show the pairing QR codes again
    tesseract server status    check the sandbox, the host shell service and tailscale serve
    tesseract sandbox logs     sandbox logs
    Update:                    git pull && ./setup-server.sh
EOF
