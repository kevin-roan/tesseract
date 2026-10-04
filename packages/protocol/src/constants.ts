export const PROTOCOL_VERSION = 1 as const;
export const API_PREFIX = "/v1" as const;
export const UI_PREFIX = "/ui" as const;
export const DEFAULT_PORT = 7700;
export const PAIRING_SCHEME = "theone" as const;
export const PAIRING_ACTION = "pair" as const;
/** `theone://host?url=…&token=…&name=…` pairs the phone with the host shell daemon (`theone-controller host pair`). */
export const HOST_PAIRING_ACTION = "host" as const;
export const HOST_SHELL_PORT = 7701;
export const HOST_SHELL_SERVICE = "host-shell" as const;
/** Host shell PIN: 6 to 12 digits, set on the host with `theone-controller host pin`. */
export const HOST_PIN_PATTERN = /^\d{6,12}$/;
export const TICKET_PARAM = "ticket" as const;
export const VNC_WS_SUBPROTOCOL = "binary" as const;
/** Stands in for names, authors, URLs and other identifying details of a confidential project. */
export const REDACTED = "REDACTED" as const;

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
  inbox: "inb_",
  upload: "upl_",
  sync: "sync_",
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
/** `--permission-mode` values a run may ask for: plan (read-only), acceptEdits (edits, no shell prompts), bypassPermissions (everything). */
export const AGENT_RUN_MODES = ["plan", "acceptEdits", "bypassPermissions"] as const;
export const UPLOAD_KINDS = ["image", "pdf", "audio", "file"] as const;
export const STT_PROFILES = ["off", "eco", "balanced", "performance"] as const;
export const STT_ENGINE_NAMES = ["whisper.cpp", "openai-compatible", "gemini"] as const;
/** `native`: the controller's own engine (whisper.cpp / openai-compatible); `gemini`: Gemini first, native when it fails. */
export const STT_PROVIDERS = ["native", "gemini"] as const;
export const AGENT_RUN_EVENT_KINDS = ["text", "tool_use", "tool_result", "system"] as const;
export const LOG_STREAMS = ["stdout", "stderr", "system"] as const;
export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export const INBOX_KINDS = ["needs_input", "permission", "completed", "failed", "status", "file"] as const;
/** `build`: collected by a build recipe; `agent`: shared with `theone-controller share` (or `POST /v1/artifacts`). */
export const ARTIFACT_SOURCES = ["build", "agent"] as const;
export const CLAUDE_SESSION_SOURCES = ["agent-run", "terminal", "cli"] as const;
export const SYNC_CHANGE_KINDS = ["added", "modified", "deleted"] as const;
export const SYNC_REQUEST_KINDS = ["pull", "revert", "get"] as const;
export const SYNC_REQUEST_STATUSES = ["pending", "claimed", "applied", "failed", "cancelled"] as const;
export const SYNC_REQUEST_SOURCES = ["mobile", "desktop", "cli"] as const;
export const IDENTITY_SOURCES = ["serve", "localapi", "none"] as const;

export const CLAUDE_AUTH_METHODS = ["oauth_token", "credentials", "api_key", "none"] as const;

/** Id of the primary Claude account (the host's `~/.claude`); others are `claude-<name>` for `~/.claude-<name>`. */
export const CLAUDE_PRIMARY_ACCOUNT_ID = "claude";
export const CLAUDE_ACCOUNT_ID_PATTERN = /^claude(-[a-z0-9][a-z0-9_-]{0,31})?$/;
export const CLAUDE_ACCOUNT_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/** `~/.claude.json` keys a Claude import may set; everything else (projects, caches) stays sandbox-local. */
export const CLAUDE_IMPORT_ACCOUNT_KEYS = [
  "oauthAccount",
  "userID",
  "hasCompletedOnboarding",
  "lastOnboardingVersion",
  "theme",
  "editorMode",
  "verbose",
] as const;

/** Files (relative to `$CLAUDE_CONFIG_DIR`) a Claude import may write: exact names or `dir/` prefixes. */
export const CLAUDE_IMPORT_PATHS = ["settings.json", "CLAUDE.md", "skills/", "agents/", "commands/", "output-styles/"] as const;

/** Top-level `settings.json` keys dropped on import: they run host commands or point at host paths. */
export const CLAUDE_IMPORT_DROPPED_SETTINGS = ["hooks", "apiKeyHelper", "awsCredentialExport", "awsAuthRefresh", "statusLine", "otelHeadersHelper"] as const;
export const SERVER_EVENT_TYPES = [
  "hello",
  "ping",
  "status",
  "process.updated",
  "terminal.updated",
  "build.updated",
  "artifact.created",
  "artifact.deleted",
  "agent.updated",
  "agent.deleted",
  "project.updated",
  "project.deleted",
  "inbox.updated",
  "stt.updated",
  "sync.updated",
  "sync.changed",
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
  defaultUsageDays: 30,
  maxUsageDays: 90,
  defaultSessionsList: 20,
  maxSessionsList: 200,
  defaultInboxList: 100,
  maxInboxList: 500,
  maxArtifactNoteLength: 500,
  maxAgentRunBatch: 500,
  maxClaudeImportFiles: 500,
  maxClaudeImportFileBytes: 512 * 1024,
  /** Body limit of `POST /v1/claude/import` (other routes keep 1 MiB). */
  maxClaudeImportBytes: 8 * 1024 * 1024,
  maxUploadBytes: 20 * 1024 * 1024,
  /** Body limit of `POST /v1/uploads`: base64 of `maxUploadBytes` plus the JSON envelope. */
  maxUploadBodyBytes: 28 * 1024 * 1024,
  maxUploadNameLength: 255,
  /** Body limit of `POST /v1/projects/:id/sync` (a tar or gzip archive). */
  maxProjectSyncBytes: 1024 * 1024 * 1024,
  maxRunAttachments: 10,
  maxSyncPaths: 5_000,
  /** Files under `.git` one `get` may update or delete. */
  maxSyncGitPaths: 200_000,
  /** Body limit of `POST /v1/sync/requests/:id/plan` (the `get` plan, which can list a whole `.git`). */
  maxSyncPlanBytes: 64 * 1024 * 1024,
  maxSyncPathLength: 4_096,
  maxSyncHostLength: 255,
  maxSyncRequestList: 50,
  syncHostOnlineMs: 60_000,
  syncClaimTimeoutMs: 10 * 60_000,
  maxTranscriptionLanguageLength: 16,
  /** A host shell session (from `POST /v1/host/unlock`) expires this long after the PIN was entered. */
  hostSessionTtlMs: 15 * 60_000,
  /** Wrong PINs allowed before the host shell locks; each further lockout doubles, capped at `hostLockoutMaxMs`. */
  hostPinMaxAttempts: 5,
  hostLockoutBaseMs: 5 * 60_000,
  hostLockoutMaxMs: 24 * 60 * 60_000,
} as const;
