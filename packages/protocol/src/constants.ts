export const PROTOCOL_VERSION = 1 as const;
export const API_PREFIX = "/v1" as const;
export const UI_PREFIX = "/ui" as const;
export const DEFAULT_PORT = 7700;
export const PAIRING_SCHEME = "theone" as const;
export const PAIRING_ACTION = "pair" as const;
export const TICKET_PARAM = "ticket" as const;
export const VNC_WS_SUBPROTOCOL = "binary" as const;

export const ERROR_CODES = [
  "unauthorized",
  "forbidden",
  "not_found",
  "bad_request",
  "conflict",
  "unavailable",
  "internal",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_STATUS = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  bad_request: 400,
  conflict: 409,
  unavailable: 503,
  internal: 500,
} as const satisfies Record<ErrorCode, number>;

export const ID_PREFIXES = {
  process: "prc_",
  terminal: "trm_",
  build: "bld_",
  artifact: "art_",
  agentRun: "run_",
} as const;
export type IdKind = keyof typeof ID_PREFIXES;

export const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
export const PROJECT_ID_MAX_LENGTH = 64;
export const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const GIT_URL_PATTERN = /^(?:https?:\/\/|ssh:\/\/|git:\/\/|file:\/\/|[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:)\S+$/;
export const GIT_REF_PATTERN = /^(?![-/.])(?!.*\.\.)[A-Za-z0-9._\/-]{1,255}$/;
export const SHA256_PATTERN = /^[a-f0-9]{64}$/;
export const AGENT_SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;

export const FRAMEWORKS = [
  "expo",
  "react-native",
  "electron",
  "vite",
  "next",
  "node",
  "android",
  "python",
  "unknown",
] as const;
export const PACKAGE_MANAGERS = ["bun", "pnpm", "yarn", "npm"] as const;
export const BUILD_TARGETS = [
  "electron-linux",
  "electron-windows",
  "android-apk",
  "web",
  "script",
] as const;
export const BUILD_PROFILES = ["debug", "release"] as const;
export const BUILD_STATES = ["queued", "running", "succeeded", "failed", "cancelled"] as const;
export const FINAL_BUILD_STATES = ["succeeded", "failed", "cancelled"] as const;
export const BUILD_STAGES = ["install", "compile", "package", "collect"] as const;
export const PROCESS_STATES = ["starting", "running", "exited", "failed", "stopped", "orphaned"] as const;
export const FINAL_PROCESS_STATES = ["exited", "failed", "stopped", "orphaned"] as const;
export const TERMINAL_KINDS = ["shell", "claude"] as const;
export const TERMINAL_STATES = ["running", "exited"] as const;
export const AGENT_RUN_STATES = ["running", "succeeded", "failed", "cancelled"] as const;
export const FINAL_AGENT_RUN_STATES = ["succeeded", "failed", "cancelled"] as const;
export const AGENT_RUN_EVENT_KINDS = ["text", "tool_use", "tool_result", "system"] as const;
export const LOG_STREAMS = ["stdout", "stderr", "system"] as const;
export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export const SERVER_EVENT_TYPES = [
  "hello",
  "ping",
  "status",
  "process.updated",
  "terminal.updated",
  "build.updated",
  "artifact.created",
  "agent.updated",
  "project.updated",
] as const;

export const LIMITS = {
  ticketTtlMs: 60_000,
  eventsPingIntervalMs: 25_000,
  processStopGraceMs: 5_000,
  defaultLogTail: 500,
  maxLogTail: 2_000,
  logReplayLines: 200,
  logRingBufferLines: 2_000,
  logRotateBytes: 5 * 1024 * 1024,
  terminalScrollbackBytes: 256 * 1024,
  contextFileMaxBytes: 64 * 1024,
  terminalMaxCols: 1_000,
  terminalMaxRows: 500,
  maxPromptLength: 200_000,
  maxCommandLength: 16_384,
  maxStatusMessageLength: 4_000,
  maxNameLength: 128,
  maxPairingNameLength: 64,
} as const;
