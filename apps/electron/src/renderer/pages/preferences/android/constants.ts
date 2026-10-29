export const ANDROID_SETTINGS_KEYS = {
  support: ["android-settings", "support"] as const,
  candidates: ["android-settings", "candidates"] as const,
  catalog: ["android-settings", "catalog"] as const,
  emulator: ["android-settings", "emulator"] as const,
};

export const ANDROID_LOG_LIMIT = 200;

/** Under `hostShell` so switching machines invalidates it with the other host queries. */
export const HOST_TOOLCHAIN_KEY = ["hostShell", "toolchain"] as const;
