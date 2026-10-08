#!/bin/sh
APP_DIR='/opt/${sanitizedProductName}'
EXECUTABLE='${executable}'
CLI_LINK=/usr/bin/tesseract
CLI_TARGET="$APP_DIR/resources/bin/tesseract"
LEGACY_APP_DIR='/opt/Monolith'
LEGACY_CLI_LINK=/usr/bin/monolith

if type update-alternatives >/dev/null 2>&1; then
  if [ -L "/usr/bin/$EXECUTABLE" ] && [ -e "/usr/bin/$EXECUTABLE" ] && [ "$(readlink "/usr/bin/$EXECUTABLE")" != "/etc/alternatives/$EXECUTABLE" ]; then
    rm -f "/usr/bin/$EXECUTABLE"
  fi
  update-alternatives --install "/usr/bin/$EXECUTABLE" "$EXECUTABLE" "$APP_DIR/$EXECUTABLE" 100 || ln -sf "$APP_DIR/$EXECUTABLE" "/usr/bin/$EXECUTABLE"
else
  ln -sf "$APP_DIR/$EXECUTABLE" "/usr/bin/$EXECUTABLE"
fi

if [ -L "$LEGACY_CLI_LINK" ]; then
  case "$(readlink "$LEGACY_CLI_LINK")" in
    "$APP_DIR/resources/bin/monolith"|"$LEGACY_APP_DIR/resources/bin/monolith") rm -f "$LEGACY_CLI_LINK" ;;
  esac
fi

if [ -L "$CLI_LINK" ] && [ "$(readlink "$CLI_LINK")" = "$LEGACY_APP_DIR/resources/bin/tesseract" ]; then
  rm -f "$CLI_LINK"
fi

if [ -x "$CLI_TARGET" ]; then
  if [ ! -e "$CLI_LINK" ] && [ ! -L "$CLI_LINK" ]; then
    ln -s "$CLI_TARGET" "$CLI_LINK"
  elif [ -L "$CLI_LINK" ] && { [ "$(readlink -f "$CLI_LINK")" = "$CLI_TARGET" ] || [ ! -e "$CLI_LINK" ]; }; then
    ln -sfn "$CLI_TARGET" "$CLI_LINK"
  else
    echo "tesseract-desktop: $CLI_LINK already exists and is not ours; leaving it alone" >&2
  fi
fi

if [ -f "$APP_DIR/chrome-sandbox" ]; then
  if ! { [ -L /proc/self/ns/user ] && unshare --user true 2>/dev/null; }; then
    chmod 4755 "$APP_DIR/chrome-sandbox" || true
  else
    chmod 0755 "$APP_DIR/chrome-sandbox" || true
  fi
fi

if hash update-mime-database 2>/dev/null; then
  update-mime-database /usr/share/mime || true
fi

if hash update-desktop-database 2>/dev/null; then
  update-desktop-database /usr/share/applications || true
fi

if apparmor_status --enabled >/dev/null 2>&1; then
  APPARMOR_SOURCE="$APP_DIR/resources/apparmor-profile"
  APPARMOR_TARGET="/etc/apparmor.d/$EXECUTABLE"
  if [ -f "$APPARMOR_SOURCE" ] && apparmor_parser --skip-kernel-load --debug "$APPARMOR_SOURCE" >/dev/null 2>&1; then
    cp -f "$APPARMOR_SOURCE" "$APPARMOR_TARGET"
    if ! { [ -x /usr/bin/ischroot ] && /usr/bin/ischroot; } && hash apparmor_parser 2>/dev/null; then
      apparmor_parser --replace --write-cache --skip-read-cache "$APPARMOR_TARGET" || true
    fi
  fi
fi

exit 0
