# shellcheck shell=sh
# Debian's /etc/profile resets PATH for login shells (including the controller's
# `bash -lc` jobs), so the sandbox toolchain directories are restored here.

theone_path_prepend() {
  case ":${PATH}:" in
    *":$1:"*) ;;
    *) PATH="$1:${PATH}" ;;
  esac
}

theone_path_append() {
  case ":${PATH}:" in
    *":$1:"*) ;;
    *) PATH="${PATH}:$1" ;;
  esac
}

if [ -n "${JAVA_HOME:-}" ]; then
  theone_path_prepend "${JAVA_HOME}/bin"
fi
if [ -n "${ANDROID_HOME:-}" ]; then
  theone_path_append "${ANDROID_HOME}/cmdline-tools/latest/bin"
  theone_path_append "${ANDROID_HOME}/platform-tools"
fi
theone_path_prepend "${HOME}/.bun/bin"
theone_path_prepend "${HOME}/.local/bin"
export PATH

unset -f theone_path_prepend theone_path_append

# Interactive terminals open GUI programs on the virtual display so they show up in VNC.
case $- in
  *i*)
    DISPLAY="${DISPLAY:-${THEONE_DISPLAY:-:1}}"
    export DISPLAY
    ;;
esac
