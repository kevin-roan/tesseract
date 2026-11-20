#!/usr/bin/env bash
# Builds the tesseract-tailnet CLI for the Electron app.
#
#   scripts/build-desktop.sh                 # all of linux, darwin, windows x amd64, arm64
#   scripts/build-desktop.sh linux/amd64 ... # selected GOOS/GOARCH pairs
#
# Output: apps/electron/resources/bin/<os>-<arch>/tesseract-tailnet[.exe], where
# <os>-<arch> uses electron-builder names (linux|mac|win, x64|arm64) to match
# apps/electron/src/core/host-tailnet.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

targets=("$@")
if [[ ${#targets[@]} -eq 0 ]]; then
  targets=(linux/amd64 linux/arm64 darwin/amd64 darwin/arm64 windows/amd64 windows/arm64)
fi

out_root="$REPO_ROOT/apps/electron/resources/bin"
cd "$MODULE_DIR"
for target in "${targets[@]}"; do
  goos="${target%/*}"
  goarch="${target#*/}"
  case "$goos" in
    linux) os=linux ;;
    darwin) os=mac ;;
    windows) os=win ;;
    *) echo "unsupported GOOS: $goos" >&2; exit 2 ;;
  esac
  case "$goarch" in
    amd64) arch=x64 ;;
    arm64) arch=arm64 ;;
    *) echo "unsupported GOARCH: $goarch" >&2; exit 2 ;;
  esac
  ext=""
  [[ "$goos" == windows ]] && ext=".exe"
  dir="$out_root/$os-$arch"
  mkdir -p "$dir"
  echo "building $goos/$goarch -> ${dir#"$REPO_ROOT/"}/tesseract-tailnet$ext" >&2
  CGO_ENABLED=0 GOOS="$goos" GOARCH="$goarch" go build \
    -ldflags "-s -w -X main.version=$VERSION" \
    -o "$dir/tesseract-tailnet$ext" ./cmd/tesseract-tailnet
done
