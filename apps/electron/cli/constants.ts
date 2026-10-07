export const CLI_ENV = {
  appPath: "MONOLITH_APP_PATH",
  sandboxContext: "MONOLITH_SANDBOX_CONTEXT",
  noColor: "NO_COLOR",
} as const;

export const GLOBAL_FLAGS = ["json", "help", "verbose"] as const;
export const SHORT_FLAGS: Readonly<Record<string, string>> = { h: "help", f: "follow" };

export const ENV_FILE_NAME = ".env";
export const ANDROID_CACHE_SUBDIR = ["android", "cache"] as const;
export const BUNDLED_SANDBOX_DIR = "sandbox";
export const BUNDLED_BIN_DIR = "bin";
export const PACKAGED_MARKER = "app.asar";
export const INSTALL_SIDECAR = "app.json";
export const SIDECAR_KEYS = { appPath: "appPath", sandboxDir: "sandboxDir" } as const;

export const APP_EXECUTABLE = {
  linux: ["..", "monolith-desktop"],
  win32: ["..", "Monolith.exe"],
  darwin: ["..", "MacOS", "Monolith"],
} as const;

export const INSTALLED_APP = {
  linux: ["/opt/Monolith/monolith-desktop"],
  darwin: ["/Applications/Monolith.app/Contents/MacOS/Monolith"],
} as const;

export const WINDOWS_INSTALL_DIR = ["Programs", "Monolith", "Monolith.exe"] as const;

export const LINK_OPENERS = {
  linux: { file: "xdg-open", args: [] as string[] },
  darwin: { file: "open", args: [] as string[] },
  win32: { file: "rundll32", args: ["url.dll,FileProtocolHandler"] },
} as const;

export const OPENER_TIMEOUT_MS = 10_000;
export const DEFAULT_LOG_TAIL = 200;
export const MIN_LISTED_API = 30;
export const SYSTEM_IMAGE_PREFIX = "system-images;";
export const PROGRESS_PLAIN_INTERVAL_MS = 5_000;
export const PERCENT = 100;
export const COLUMN_GAP = 2;
export const SECTION_INDENT = "  ";
export const INTERRUPTED_EXIT = 130;

export const COMPONENT_KEYWORDS = { all: "all", none: "none" } as const;
export const BASE_IMAGE_ALIASES = ["chrome", "chromium"] as const;

export const QR = {
  quietZone: 2,
  errorCorrection: "M",
  ansiReset: "\u001b[0m",
  ansiDarkOnLight: "\u001b[30;107m",
} as const;

export const QR_BLOCKS = { both: "█", top: "▀", bottom: "▄", none: " " } as const;

export const REDACTED_KEYS = ["token", "tokenSealed"] as const;
export const REDACTED_VALUE = "…";

export const STATUS_MARK = { ok: "ok", warning: "warn", error: "FAIL", pending: "…" } as const;
