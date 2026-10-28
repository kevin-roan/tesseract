export const PROTOCOL_VERSION = 1 as const;
export const API_PREFIX = "/v1" as const;
export const UI_PREFIX = "/ui" as const;
export const DEFAULT_PORT = 7700;
export const PAIRING_SCHEME = "tesseract" as const;
export const PAIRING_ACTION = "pair" as const;
/** `tesseract://host?url=…&token=…&name=…` pairs the phone with the host shell daemon (`tesseract-controller host pair`). */
export const HOST_PAIRING_ACTION = "host" as const;
export const HOST_SHELL_PORT = 7701;
export const HOST_SHELL_SERVICE = "host-shell" as const;
/** Port of the host workspace controller (`tesseract-controller host workspace serve`), which runs `tesseract --unsafe-repo` projects on the host. */
export const HOST_WORKSPACE_PORT = 7702;
/** Where a controller runs its projects: in the sandbox container, or directly on the host (no sandbox, no display, no emulator). */
export const PROJECT_RUNTIMES = ["sandbox", "host"] as const;
/** Host shell PIN: 6 to 12 digits, set on the host with `tesseract-controller host pin`. */
export const HOST_PIN_PATTERN = /^\d{6,12}$/;
export const TICKET_PARAM = "ticket" as const;
export const VNC_WS_SUBPROTOCOL = "binary" as const;
/** Sandbox loopback port the controller tunnels to the host emulator's adbd (adb serial `127.0.0.1:<port>`). */
export const DEFAULT_ADB_TUNNEL_PORT = 15555;
/** Host emulator console port; adbd listens on +1 and the serial is `emulator-<port>`. */
export const DEFAULT_EMULATOR_PORT = 5554;
/** Console ports an emulator can use (even, 5554-5682); the host adb serial of one is `emulator-<port>`. */
export const EMULATOR_PORT_RANGE = { min: 5554, max: 5682 } as const;
/** Host adb serial of a plain emulator (one the host shares with `TESSERACT_ANDROID_SHARE_EMULATORS`). */
export const EMULATOR_SERIAL_PATTERN = /^emulator-(\d{4})$/;
export const DEFAULT_EMULATOR_GPU = "swiftshader_indirect" as const;
/** Close code of an Android link replaced by a newer one. */
export const ANDROID_LINK_REPLACED_CLOSE_CODE = 4000;
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
  appRun: "app_",
  adbStream: "adb_",
  iosStream: "ios_",
  iosInstall: "ins_",
  iosRequest: "ior_",
  deploy: "dep_",
  issue: "iss_",
  issueComment: "isc_",
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
  "flutter",
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
/** `--model` aliases a run may ask for; Claude Code maps each to the latest model of that family. No model = the account's default. */
export const AGENT_RUN_MODELS = ["opus", "sonnet", "haiku"] as const;
export const UPLOAD_KINDS = ["image", "pdf", "audio", "file"] as const;
export const STT_PROFILES = ["off", "eco", "balanced", "performance"] as const;
export const STT_ENGINE_NAMES = ["whisper.cpp", "openai-compatible", "gemini"] as const;
/** `native`: the controller's own engine (whisper.cpp / openai-compatible); `gemini`: Gemini first, native when it fails. */
export const STT_PROVIDERS = ["native", "gemini"] as const;
/** Where the Gemini key comes from: `settings` (saved from the mobile or desktop app, or `tesseract --gemini-key`). */
export const GEMINI_KEY_SOURCES = ["settings"] as const;
export const AGENT_RUN_EVENT_KINDS = ["text", "tool_use", "tool_result", "system"] as const;
export const LOG_STREAMS = ["stdout", "stderr", "system"] as const;
export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export const INBOX_KINDS = ["needs_input", "permission", "completed", "failed", "status", "file"] as const;
/** `build`: collected by a build recipe; `agent`: shared with `tesseract-controller share` (or `POST /v1/artifacts`). */
export const ARTIFACT_SOURCES = ["build", "agent"] as const;
export const CLAUDE_SESSION_SOURCES = ["agent-run", "terminal", "cli"] as const;
export const SYNC_CHANGE_KINDS = ["added", "modified", "deleted"] as const;
export const SYNC_REQUEST_KINDS = ["pull", "revert", "get"] as const;
export const SYNC_REQUEST_STATUSES = ["pending", "claimed", "applied", "failed", "cancelled"] as const;
export const SYNC_REQUEST_SOURCES = ["mobile", "desktop", "cli"] as const;
export const DEPLOY_KINDS = ["compose", "dockerfile"] as const;
export const DEPLOY_STATUSES = ["pending", "claimed", "awaiting_approval", "deploying", "deployed", "failed", "rejected", "cancelled"] as const;
export const DEPLOY_ACTIVE_STATUSES = ["pending", "claimed", "awaiting_approval", "deploying"] as const;
/** Workflow columns of a project issue, in board order. */
export const ISSUE_STATUSES = ["backlog", "todo", "in_progress", "in_review", "done", "canceled"] as const;
/** `done` and `canceled` close an issue; Claude never works on a closed issue. */
export const ISSUE_CLOSED_STATUSES = ["done", "canceled"] as const;
export const ISSUE_PRIORITIES = ["none", "urgent", "high", "medium", "low"] as const;
/** `claude`: the controller dispatches an agent run for the issue; `me`: the sandbox owner. */
export const ISSUE_ASSIGNEES = ["me", "claude"] as const;
export const ISSUE_COMMENT_AUTHORS = ["me", "claude", "system"] as const;
export const IDENTITY_SOURCES = ["serve", "localapi", "none"] as const;

export const RUN_TARGETS = [
  "web-dev",
  "expo-device",
  "expo-web",
  "expo-android",
  "expo-ios",
  "rn-android",
  "flutter-web",
  "flutter-linux",
  "flutter-android",
  "electron-dev",
  "test",
] as const;
type RunTargetName = (typeof RUN_TARGETS)[number];
export const APP_RUN_STATES = ["starting", "ready", "failed", "stopped", "exited"] as const;
export const FINAL_APP_RUN_STATES = ["failed", "stopped", "exited"] as const;
export const APP_RUN_ACTIONS = ["reload", "restart", "focus"] as const;
export const APP_VIEWER_KINDS = ["url", "deeplink", "display", "android", "ios", "none"] as const;

/** First port tried when `StartAppRun.port` is omitted; targets without an entry take no port. */
export const RUN_TARGET_DEFAULT_PORTS = {
  "web-dev": 5173,
  "expo-device": 8081,
  "expo-web": 8081,
  "expo-android": 8081,
  "expo-ios": 8081,
  "rn-android": 8081,
  "flutter-web": 8090,
} as const satisfies Partial<Record<RunTargetName, number>>;

export const RUN_TARGET_VIEWERS = {
  "web-dev": "url",
  "expo-device": "deeplink",
  "expo-web": "url",
  "expo-android": "android",
  "expo-ios": "ios",
  "rn-android": "android",
  "flutter-web": "url",
  "flutter-linux": "display",
  "flutter-android": "android",
  "electron-dev": "display",
  test: "none",
} as const satisfies Record<RunTargetName, (typeof APP_VIEWER_KINDS)[number]>;

export const RUN_TARGET_ACTIONS = {
  "web-dev": [],
  "expo-device": ["reload", "restart"],
  "expo-web": [],
  "expo-android": ["reload", "restart"],
  "expo-ios": ["reload", "restart"],
  "rn-android": ["reload", "restart"],
  "flutter-web": ["reload", "restart"],
  "flutter-linux": ["reload", "restart", "focus"],
  "flutter-android": ["reload", "restart"],
  "electron-dev": ["focus"],
  test: [],
} as const satisfies Record<RunTargetName, readonly (typeof APP_RUN_ACTIONS)[number][]>;

/** Host `TESSERACT_EMULATOR_ISOLATION`: `netns` runs the emulator in its own network namespace, `none` on the host network. */
export const EMULATOR_ISOLATION_MODES = ["netns", "none"] as const;
export const EMULATOR_STATES = ["unavailable", "stopped", "starting", "running", "stopping", "failed"] as const;
/** Keys the screen page may send (`{ type: "key" }` on `/v1/android/screen`). */
export const ANDROID_KEYS = [
  "back",
  "home",
  "app_switch",
  "power",
  "volume_up",
  "volume_down",
  "enter",
  "del",
  "tab",
  "escape",
  "up",
  "down",
  "left",
  "right",
] as const;
export const ANDROID_TOUCH_ACTIONS = ["down", "move", "up", "cancel"] as const;
/** AVD names as listed by `emulator -list-avds`. */
export const AVD_NAME_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
/** adb serials (`emulator-5554`, `192.168.56.101:5555`, USB serials, mDNS names); never starts with `-`. */
export const ADB_SERIAL_PATTERN = /^[A-Za-z0-9[][A-Za-z0-9._:%[\]-]{0,127}$/;
/** `h264` sends scrcpy's stream untouched when the viewer can decode it (WebCodecs), else JPEG; `mjpeg` always sends JPEG. */
export const ANDROID_STREAM_ENCODINGS = ["h264", "mjpeg"] as const;
/** First byte of an H.264 screen message: bit 0 codec config (SPS/PPS), bit 1 key frame. */
export const ANDROID_H264_FLAGS = { config: 1, keyFrame: 2 } as const;
/** `emulator`: an Android Studio emulator; `genymotion`: a Genymotion VM; `network`: adb over TCP/Wi-Fi; `usb`: anything else. */
export const ANDROID_DEVICE_KINDS = ["emulator", "genymotion", "network", "usb"] as const;
/** Host Android screen stream settings when `state.json` sets none (`GET/PUT /v1/android/stream`). */
export const DEFAULT_ANDROID_STREAM = {
  encoding: "h264",
  bitRate: 8_000_000,
  maxFps: 60,
  maxSize: null,
  keyFrameInterval: 2,
  jpegQuality: 5,
  device: null,
} as const;
/** Host iOS screen stream settings when `state.json` sets none (`GET/PUT /v1/ios/stream`); same limits as Android. */
export const DEFAULT_IOS_STREAM = {
  encoding: "h264",
  bitRate: 6_000_000,
  maxFps: 60,
  maxSize: null,
  keyFrameInterval: 2,
  jpegQuality: 7,
} as const;

/** `?signal=` of stop routes: `SIGTERM` (default) stops gracefully, `SIGKILL` kills the process group at once. */
export const STOP_SIGNALS = ["SIGTERM", "SIGKILL"] as const;
export type StopSignal = (typeof STOP_SIGNALS)[number];
export const DEFAULT_STOP_SIGNAL: StopSignal = "SIGTERM";

/** `GET /v1/ios`: the host's Simulator devices (`xcrun simctl list devices`); `failed` = a boot the daemon started did not finish. */
export const SIM_STATES = ["unavailable", "shutdown", "booting", "booted", "shutting_down", "failed"] as const;
/** Why `GET /v1/ios` is `available: false`: off (`TESSERACT_IOS`), not a Mac, no Xcode (`xcrun simctl`), no idb / idb_companion. */
export const IOS_UNAVAILABLE_CODES = ["disabled", "not_macos", "no_xcode", "no_idb"] as const;
/** The Simulator always shares the Mac's network stack; there is no isolated mode. */
export const IOS_ISOLATION_MODES = ["none"] as const;
/** CoreSimulator device UDIDs. */
export const SIM_UDID_PATTERN = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;
/** Keys `/v1/ios/screen` acts on (`power` = the lock button); the other `ANDROID_KEYS` are ignored on iOS. */
export const IOS_KEYS = ["home", "power", "enter", "del", "tab", "escape", "up", "down", "left", "right"] as const;
/** Close code of an iOS link replaced by a newer one. */
export const IOS_LINK_REPLACED_CLOSE_CODE = 4000;
/** Close code the sandbox uses for an iOS link stream whose `port` is not the Metro port of a running `*-ios` app run. */
export const IOS_STREAM_REFUSED_CLOSE_CODE = 4003;
/** A sandbox-supplied `.app` waits for the user on the phone (`POST /v1/ios/installs/:id`) unless its sha256 was approved before. */
export const IOS_INSTALL_STATES = ["pending", "approved", "rejected", "expired", "installing", "installed", "failed"] as const;
/** `progress` stages of an iOS link request. */
/** A sandbox request over the iOS link (`SandboxIosStatus.requests`): `running` until the host's `result`. */
export const IOS_LINK_REQUEST_STATES = ["running", "succeeded", "failed"] as const;
export const IOS_LINK_REQUEST_TYPES = ["openUrl", "install"] as const;
export const IOS_LINK_STAGES = ["awaiting_confirmation", "downloading", "installing", "installing_expo_go", "opening"] as const;
/** Expo Go's bundle id; the host installs Expo's published simulator build when it is missing. */
export const EXPO_GO_BUNDLE_ID = "host.exp.Exponent";
/** Expo's version index; `sdkVersions[<sdk>].iosClientUrl` (else `iosUrl`) is the Expo Go simulator build. */
export const EXPO_VERSIONS_URL = "https://api.expo.dev/v2/versions/latest";
/** URL schemes of an app run (`openUrl`): lower case, not a system scheme (`IOS_RESERVED_URL_SCHEMES`). */
export const IOS_APP_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]{1,63}$/;
/** Schemes the sandbox may never open in the Simulator, even when it announces them as an app scheme. */
export const IOS_RESERVED_URL_SCHEMES = [
  "http",
  "https",
  "file",
  "ftp",
  "data",
  "javascript",
  "about",
  "blob",
  "exp",
  "exps",
  "tel",
  "telprompt",
  "sms",
  "mailto",
  "facetime",
  "facetime-audio",
  "maps",
  "itms",
  "itms-apps",
  "itms-services",
  "itms-beta",
  "prefs",
  "app-prefs",
  "app-settings",
  "shortcuts",
  "calshow",
  "x-apple-health",
  "x-apple-reminderkit",
  "x-web-search",
  "message",
  "music",
  "photos-redirect",
  "wallet",
  "shoebox",
] as const;

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

/** Slash command name without the `/`: lowercase segments joined by `:` (`frontend:review` for `commands/frontend/review.md`). */
export const CLAUDE_COMMAND_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*(:[a-z0-9][a-z0-9_-]*)*$/;

/** Claude Code built-ins that work in headless `claude -p` runs, listed by `GET /v1/claude/commands`. */
export const CLAUDE_BUILTIN_COMMANDS = [
  { name: "compact", description: "Summarize the conversation to free up context" },
  { name: "context", description: "Show how the context window is used" },
  { name: "cost", description: "Show the token usage and cost of this session" },
  { name: "init", description: "Create a CLAUDE.md with notes about this codebase" },
  { name: "review", description: "Review a pull request" },
  { name: "security-review", description: "Review the pending changes for security issues" },
  { name: "pr-comments", description: "Show the comments of a GitHub pull request" },
] as const;
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
  "app.updated",
  "deploy.updated",
  "issue.updated",
  "issue.deleted",
  "issue.commented",
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
  /** Archive limit of a deploy bundle (the source directory as tar.gz). */
  maxDeployBundleBytes: 512 * 1024 * 1024,
  maxDeployLogLength: 64 * 1024,
  maxDeployList: 50,
  maxDeployTargets: 100,
  maxIssueTitleLength: 256,
  maxIssueDescriptionLength: 100_000,
  maxIssueCommentLength: 50_000,
  maxIssueLabels: 20,
  maxIssueLabelLength: 48,
  maxIssueList: 1_000,
  maxIssueComments: 500,
  maxDeployCpus: 64,
  minDeployMemoryMb: 256,
  maxDeployMemoryMb: 262_144,
  /** Deploy targets reported by a host heartbeat older than this are dropped. */
  deployTargetsTtlMs: 60_000,
  /** A claimed deploy with no progress for this long goes back to `pending`. */
  deployClaimTimeoutMs: 15 * 60_000,
  /** A deploy awaiting approval longer than this is `rejected`. */
  deployApprovalTimeoutMs: 30 * 60_000,
  maxTranscriptionLanguageLength: 16,
  /** A host shell session (from `POST /v1/host/unlock`) expires this long after the PIN was entered. */
  hostSessionTtlMs: 10 * 60 * 60_000,
  /** Wrong PINs allowed before the host shell locks; each further lockout doubles, capped at `hostLockoutMaxMs`. */
  hostPinMaxAttempts: 5,
  hostLockoutBaseMs: 5 * 60_000,
  hostLockoutMaxMs: 24 * 60 * 60_000,
  /** An app run not `ready` after this long is stopped and `failed`. */
  appRunReadyTimeoutMs: 15 * 60_000,
  appRunReadyPollMs: 500,
  metroReloadTimeoutMs: 3_000,
  emulatorBootTimeoutMs: 5 * 60_000,
  emulatorBootPollMs: 2_000,
  /** The sandbox pings the host over the Android link this often. */
  androidLinkPingIntervalMs: 20_000,
  androidLinkReconnectMinMs: 1_000,
  androidLinkReconnectMaxMs: 30_000,
  /** The host must open the data socket of an adb stream within this long. */
  androidStreamOpenTimeoutMs: 10_000,
  /** Other host emulators shared over the Android link at most (one console port pair each in 5554-5682). */
  maxSharedEmulators: 64,
  /** A screen socket buffering more than this skips frames until it drains. */
  androidScreenBackpressureBytes: 512 * 1024,
  maxAndroidTextLength: 300,
  maxAndroidPointerId: 9,
  maxAndroidScroll: 16,
  maxAndroidScreenSize: 4_096,
  minAndroidScreenSize: 160,
  minAndroidBitRate: 250_000,
  maxAndroidBitRate: 50_000_000,
  maxAndroidFps: 120,
  maxAndroidKeyFrameInterval: 10,
  /** ffmpeg `-q:v`: 2 is the best JPEG quality, 31 the worst. */
  minAndroidJpegQuality: 2,
  maxAndroidJpegQuality: 31,
  /** `simctl bootstatus` waits at most this long before the device is `failed`. */
  iosBootTimeoutMs: 5 * 60_000,
  /** The sandbox pings the host over the iOS link this often (same as Android). */
  iosLinkPingIntervalMs: 20_000,
  iosLinkReconnectMinMs: 1_000,
  iosLinkReconnectMaxMs: 30_000,
  /** Metro ports the sandbox may announce at once (one per running `*-ios` app run). */
  maxIosRuns: 8,
  /** Reverse-tunnel connections open at once over one iOS link. */
  maxIosStreams: 64,
  maxIosUrlLength: 2_048,
  maxIosRequestIdLength: 64,
  /** An install waiting for confirmation expires after this long. */
  iosInstallConfirmTimeoutMs: 10 * 60_000,
  /** Largest artifact (`.tar.gz` / `.zip` with an `.app`) the host downloads for an install. */
  maxIosInstallBytes: 2 * 1024 * 1024 * 1024,
  /** Bundle hashes the host remembers as approved (oldest dropped first). */
  maxIosApprovedBundles: 100,
} as const;
