#!/bin/sh
APP_DIR='/opt/${sanitizedProductName}'
EXECUTABLE='${executable}'
CLI_LINK=/usr/bin/tesseract
CLI_TARGET="$APP_DIR/resources/bin/tesseract"

if [ -L "$CLI_LINK" ] && { [ "$(readlink "$CLI_LINK")" = "$CLI_TARGET" ] || [ ! -e "$CLI_LINK" ]; }; then
  rm -f "$CLI_LINK"
fi

if type update-alternatives >/dev/null 2>&1; then
  update-alternatives --remove "$EXECUTABLE" "$APP_DIR/$EXECUTABLE" || true
else
  rm -f "/usr/bin/$EXECUTABLE"
fi

APPARMOR_TARGET="/etc/apparmor.d/$EXECUTABLE"
if [ -f "$APPARMOR_TARGET" ]; then
  if apparmor_status --enabled >/dev/null 2>&1; then
    if ! { [ -x /usr/bin/ischroot ] && /usr/bin/ischroot; } && hash apparmor_parser 2>/dev/null; then
      apparmor_parser --remove "$APPARMOR_TARGET" || true
    fi
  fi
  rm -f "$APPARMOR_TARGET"
fi

exit 0
