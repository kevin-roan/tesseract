#!/usr/bin/env bash
# Builds the Android library with gomobile.
#
# Output: apps/mobile/modules/tesseract-tailnet/android/libs/tailnet.aar
# (plus tailnet-sources.jar). Java API: class tailnet.Tailnet.
#
# Needs ANDROID_HOME (or ANDROID_SDK_ROOT) with an NDK installed; set
# ANDROID_NDK_HOME to pick one, otherwise the newest under $ANDROID_HOME/ndk is used.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "$ANDROID_HOME" || ! -d "$ANDROID_HOME" ]]; then
  echo "set ANDROID_HOME to the Android SDK" >&2
  exit 1
fi
if [[ -z "${ANDROID_NDK_HOME:-}" ]]; then
  ndk="$(ls -1d "$ANDROID_HOME"/ndk/*/ 2>/dev/null | sort -V | tail -n 1 || true)"
  if [[ -z "$ndk" ]]; then
    echo "no NDK under $ANDROID_HOME/ndk; install one with sdkmanager 'ndk;<version>'" >&2
    exit 1
  fi
  export ANDROID_NDK_HOME="${ndk%/}"
fi
echo "using NDK $ANDROID_NDK_HOME" >&2

ensure_gomobile

out_dir="$REPO_ROOT/apps/mobile/modules/tesseract-tailnet/android/libs"
mkdir -p "$out_dir"
cd "$MODULE_DIR"
gomobile bind \
  -target android \
  -androidapi "${ANDROID_API:-24}" \
  -ldflags "-s -w" \
  -o "$out_dir/tailnet.aar" \
  .
echo "wrote ${out_dir#"$REPO_ROOT/"}/tailnet.aar" >&2
