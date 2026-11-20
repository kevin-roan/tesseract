# Sourced by the build scripts. Sets MODULE_DIR, REPO_ROOT and VERSION.
set -euo pipefail
MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$MODULE_DIR/../.." && pwd)"
VERSION="${TESSERACT_TAILNET_VERSION:-$(git -C "$REPO_ROOT" describe --tags --always --dirty 2>/dev/null || echo dev)}"
export GOFLAGS="${GOFLAGS:--trimpath}"

# ensure_gomobile installs gomobile and gobind into GOPATH/bin when missing.
ensure_gomobile() {
  local gobin
  gobin="$(go env GOBIN)"
  [[ -n "$gobin" ]] || gobin="$(go env GOPATH)/bin"
  export PATH="$gobin:$PATH"
  if ! command -v gomobile >/dev/null 2>&1 || ! command -v gobind >/dev/null 2>&1; then
    echo "installing gomobile and gobind into $gobin" >&2
    go install golang.org/x/mobile/cmd/gomobile@latest
    go install golang.org/x/mobile/cmd/gobind@latest
  fi
  gomobile init
}
