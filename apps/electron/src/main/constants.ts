export const WINDOW_STATE_FILE = "window-state.json";
export const WINDOW_STATE_SAVE_DELAY_MS = 400;
export const WINDOW_VISIBLE_MIN = { width: 96, height: 48 } as const;

export const SETTINGS_WATCH_DELAY_MS = 250;
export const ONBOARDING_LOG_FLUSH_MS = 100;

export const UPDATE_FIRST_CHECK_DELAY_MS = 60_000;
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const UPDATES_DISABLED_ENV = "MONOLITH_DISABLE_UPDATES";
export const LINUX_PACKAGE_TYPE_FILE = "package-type";

export const CLI_INSTALL_TIMEOUT_MS = 120_000;
export const CLI_MAC_LINK_DIR = "/usr/local/bin";
export const CLI_DEB_LINK_DIR = "/usr/bin";
export const CLI_USER_LINK_DIR = [".local", "bin"] as const;
export const CLI_USER_DATA_DIR = [".local", "share", "monolith"] as const;
export const CLI_USER_COPY_DIR = [...CLI_USER_DATA_DIR, "bin"] as const;
export const CLI_INSTALL_SIDECAR = "app.json";
export const CLI_STABLE_SANDBOX_DIR = "sandbox";
export const BUNDLED_SANDBOX_DIR = "sandbox";
export const SANDBOX_MANIFEST = "manifest.json";
export const SANDBOX_SYNC_MARKER = ".bundle-hash";
export const OSASCRIPT_CANCELLED = "-128";

export const TRAY_ICON = {
  default: ["icons", "tray.png"],
  macTemplate: ["icons", "trayTemplate.png"],
  size: { darwin: 16, win32: 16, linux: 22 },
} as const;
export const WINDOW_ICON = ["icons", "256x256.png"] as const;

export const EXTERNAL_PROTOCOLS: readonly string[] = ["http:", "https:", "mailto:"];
export const ALLOWED_PERMISSIONS: readonly string[] = [
  "media",
  "clipboard-read",
  "clipboard-sanitized-write",
  "fullscreen",
  "notifications",
  "pointerLock",
  "keyboardLock",
];
export const LOCAL_COMMAND_FLAGS = ["sync", "pull", "revert", "sync-status", "get"] as const;
export const LOCAL_MODIFIER_FLAGS = ["confidential", "dry-run", "force"] as const;
export const DEEP_LINK_PREFERENCES = ["preferences", "settings"] as const;
export const DEEP_LINK_ONBOARDING = ["onboarding", "setup"] as const;
export const DEEP_LINK_FLAG_VALUES: readonly string[] = ["", "1", "true", "yes"];
export const CLI_DEV_RUNNER = "bun";
export const CLI_DEV_ENTRY = ["cli", "index.ts"] as const;
export const LOCAL_COMMAND_EXIT = { error: 1, interrupted: 130 } as const;
export const PROJECT_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
export const TRAY_WATCHER_NAME = "org.kde.StatusNotifierWatcher";
export const TRAY_HOST_CHECK_TIMEOUT_MS = 2_000;
export const TRAY_HOST_RESTART_MS = 5_000;
export const GDBUS = "gdbus";
export const DBUS_HAS_OWNER_ARGS = [
  "call",
  "--session",
  "--dest",
  "org.freedesktop.DBus",
  "--object-path",
  "/org/freedesktop/DBus",
  "--method",
  "org.freedesktop.DBus.NameHasOwner",
] as const;
export const DBUS_MONITOR_ARGS = ["monitor", "--session", "--dest", "org.freedesktop.DBus", "--object-path", "/org/freedesktop/DBus"] as const;
