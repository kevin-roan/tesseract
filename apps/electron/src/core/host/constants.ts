import type { HostShellState } from "../../shared/contracts/hostShell";

export const HOST_SHELL = {
  cliTimeoutMs: 30_000,
  healthTimeoutMs: 1_500,
  stopGraceMs: 5_000,
  shutdownWaitMs: 3_000,
  sessionMarginMs: 30_000,
  hostTimeoutMs: 10_000,
  listeningMarker: "host shell listening",
  logLimit: 200,
  pinPattern: /^[0-9]{6,12}$/,
} as const;

export const INITIAL_HOST_SHELL_STATE: HostShellState = {
  status: "stopped",
  pairing: null,
  error: null,
  log: [],
  autostart: false,
  sessionExpiresAt: null,
};

export const LOG_FLUSH_MS = 100;

export const HOST_SERVICE_NAME = "host-shell";
export const HEALTH_PATH = "/v1/health";
export const ERROR_PREFIX = /^error:\s*/i;

export const CONTROLLER_ENTRY = ["apps", "controller", "src", "index.ts"] as const;
export const CONTROLLER_PREBUILT = ["apps", "controller", "dist", "tesseract-controller"] as const;
export const CONTROLLER_BINARY = "tesseract-controller";
export const BUNDLED_BIN_DIR = "bin";

export const HOST_ARGS = {
  host: "host",
  serve: ["serve"],
  pin: ["pin", "--stdin"],
  pair: ["pair", "--json"],
  rotate: ["token", "--rotate"],
} as const;

export const SETPRIV = { binary: "setpriv", args: ["--pdeathsig", "TERM", "--"] } as const;

export const SESSION_REQUIRED = "pin-session";

export const HOST_ENV = {
  sdkRoot: "TESSERACT_ANDROID_SDK_ROOT",
  adb: "TESSERACT_ADB",
  scrcpyServer: "TESSERACT_SCRCPY_SERVER",
  scrcpyVersion: "TESSERACT_SCRCPY_VERSION",
  ffmpeg: "TESSERACT_FFMPEG",
  bunInstall: "BUN_INSTALL",
  adbForScrcpy: "ADB",
} as const;

export const HOST_ANDROID_ENV_KEYS = [HOST_ENV.sdkRoot, HOST_ENV.adb] as const;

export const SDK_LAYOUT = {
  emulator: ["emulator", "emulator"],
  adb: ["platform-tools", "adb"],
} as const;

export const VIEWER = {
  binary: "scrcpy",
  stderrLines: 20,
  earlyExitMs: 1_500,
  errorPrefix: /^ERROR:\s*/,
} as const;
