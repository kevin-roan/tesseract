#!/usr/bin/env bash
# Builds the iOS framework with gomobile. macOS with Xcode only.
#
# Output: apps/mobile/modules/tesseract-tailnet/ios/Tailnet.xcframework
# (device and simulator slices). ObjC prefix "Tailnet" (TailnetStart, ...).
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

if [[ "$(uname -s)" != Darwin ]]; then
  echo "build-ios.sh needs macOS with Xcode" >&2
  exit 1
fi
if ! xcrun --sdk iphoneos --show-sdk-path >/dev/null 2>&1; then
  echo "Xcode command line tools with the iOS SDK are required (xcode-select --install)" >&2
  exit 1
fi

ensure_gomobile

out="$REPO_ROOT/apps/mobile/modules/tesseract-tailnet/ios/Tailnet.xcframework"
mkdir -p "$(dirname "$out")"
rm -rf "$out"
cd "$MODULE_DIR"
gomobile bind \
  -target ios,iossimulator \
  -iosversion "${IOS_VERSION:-15.1}" \
  -ldflags "-s -w" \
  -o "$out" \
  .
echo "wrote ${out#"$REPO_ROOT/"}" >&2
