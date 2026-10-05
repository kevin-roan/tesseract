from types import MappingProxyType

TITLE = "Display"

BADGES = MappingProxyType({
    "offline": "Offline",
    "loading": "Checking",
    "error": "Unreachable",
    "no_display": "No display",
    "preview": "Screenshots only",
    "idle": "Idle",
    "connecting": "Connecting",
    "authenticating": "Authenticating",
    "connected": "Live",
    "retrying": "Reconnecting",
    "auth_failed": "Password rejected",
    "unavailable": "VNC unavailable",
    "failed": "Disconnected",
})

EMPTY = MappingProxyType({
    "offline": ("Sandbox unreachable", "{error}", "Retry"),
    "loading": ("Checking the display…", "Asking the controller about the virtual display.", None),
    "error": ("Couldn't reach the display", "{error}", "Try again"),
    "no_display": (
        "The display is not running",
        "Xvnc on {display} is down, so there is nothing to show. It restarts automatically; check again in a moment.",
        "Check again",
    ),
})

OVERLAY = MappingProxyType({
    "idle": ("Starting viewer…", None, None),
    "connecting": ("Connecting to the display…", "Opening the VNC bridge through the controller.", None),
    "authenticating": ("Authenticating…", "Sending the VNC password.", None),
    "retrying": ("Connection lost", "{error}Reconnecting in {seconds}s (attempt {attempt}).", "Reconnect now"),
    "auth_failed": (
        "VNC password rejected",
        "{error}The sandbox may have been restarted with a new password.",
        "Try again",
    ),
    "failed": ("Viewer stopped", "{error}", "Reconnect"),
    "unavailable": ("VNC is not answering", None, "Check again"),
})

PREVIEW = MappingProxyType({
    "title": "VNC is not answering",
    "message": "The display is up but its VNC server is not. Showing a screenshot every {seconds}s until it is back.",
    "action": "Check again",
    "loading": "Taking a screenshot…",
})

META = MappingProxyType({
    "resolution": "{width}×{height}",
    "scale": "{percent}%",
})

ACTIONS = MappingProxyType({
    "fit": "Fit",
    "actual": "1:1",
    "fit_tooltip": "Scale the display to the window",
    "actual_tooltip": "Show the display pixel for pixel",
    "view_only": "View only (ignore mouse and keyboard)",
    "clipboard": "Sync clipboard with the sandbox",
    "keys": "Send keys",
    "screenshot": "Save a screenshot",
    "browser": "Open in browser (noVNC)",
    "reconnect": "Reconnect",
    "windows": "Open windows",
    "fullscreen": "Fullscreen (F11)",
    "exit_fullscreen": "Exit fullscreen (F11)",
})

MENU = MappingProxyType({
    "more": "More actions",
    "view_only": "View only",
    "clipboard": "Sync clipboard",
    "keys": "Send keys",
    "screenshot": "Save screenshot…",
    "browser": "Open in browser",
})

KEY_COMBOS = MappingProxyType({
    "ctrl-alt-delete": "Ctrl+Alt+Delete",
    "ctrl-alt-backspace": "Ctrl+Alt+Backspace",
    "alt-tab": "Alt+Tab",
    "alt-f4": "Alt+F4",
    "super": "Super",
    "escape": "Escape",
    "print": "Print Screen",
})

WINDOWS = MappingProxyType({
    "title": "Open windows",
    "refresh": "Refresh",
    "loading": "Reading the sandbox's windows…",
    "empty_title": "No windows open",
    "empty_message": "Nothing is showing on the sandbox display.",
    "error_title": "Couldn't list the windows",
    "untitled": "Untitled window",
    "active": "Active",
    "minimized": "Minimized",
    "close": "Close window",
    "force": "Force quit",
    "force_title": "Force quit this app?",
    "force_message": "Its process is killed without a chance to save. Use this when the window doesn't respond to Close.",
    "cancel": "Cancel",
})

TOASTS = MappingProxyType({
    "screenshot_saved": "Screenshot saved to {name}",
    "screenshot_failed": "Screenshot failed: {error}",
    "browser_failed": "Couldn't open the browser: {error}",
    "clipboard_received": "Clipboard received from the sandbox",
    "window_failed": "Window action failed: {error}",
})

SCREENSHOT_FILE = "monolith-display-{stamp}.png"
SCREENSHOT_STAMP = "%Y%m%d-%H%M%S"
SCREENSHOT_FILTER = "PNG image"
