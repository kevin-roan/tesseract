#!/usr/bin/env bash
# Builds the desktop app icon from the mobile app icon: the same artwork as a rounded square with a
# margin (Linux icon proportions), at every hicolor size. Rerun after the mobile icon changes.
set -euo pipefail

readonly APP_ID="dev.tesseract.Desktop"
readonly DESKTOP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly SOURCE="${DESKTOP_DIR}/../mobile/assets/images/icon.png"
readonly HICOLOR="${DESKTOP_DIR}/data/icons/hicolor"
readonly SIZES=(16 22 24 32 48 64 128 256 512)
# Out of 1024: the square spans 896 (a 64 margin) with 224 corners, as in the previous 128 px icon (112, 28).
readonly SQUARE=896 RADIUS=224

command -v magick > /dev/null || {
  echo "make-icons: needs ImageMagick 7 (magick)" >&2
  exit 1
}

master="$(mktemp --suffix=.png)"
trap 'rm -f "${master}"' EXIT
magick "${SOURCE}" -resize "${SQUARE}x${SQUARE}!" -alpha set \
  \( -size "${SQUARE}x${SQUARE}" xc:none -fill white -draw "roundrectangle 0,0 $((SQUARE - 1)),$((SQUARE - 1)) ${RADIUS},${RADIUS}" \) \
  -compose DstIn -composite \
  -compose Over -background none -gravity center -extent 1024x1024 "${master}"

for size in "${SIZES[@]}"; do
  mkdir -p "${HICOLOR}/${size}x${size}/apps"
  magick "${master}" -filter Lanczos -resize "${size}x${size}" -strip "${HICOLOR}/${size}x${size}/apps/${APP_ID}.png"
done
rm -f "${HICOLOR}/scalable/apps/${APP_ID}.svg"
echo "Wrote ${APP_ID}.png in ${#SIZES[@]} sizes under ${HICOLOR}"
