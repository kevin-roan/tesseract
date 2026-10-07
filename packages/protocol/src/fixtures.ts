import type {
  AndroidLinkInfo,
  AppRun,
  EmulatorInfo,
  HostAndroidStatus,
  RunTargetInfo,
  SandboxAndroidStatus,
  AgentContext,
  AgentRun,
  AgentRunDetail,
  AgentRunEvent,
  Transcription,
  SttStatus,
  Upload,
  Artifact,
  BuildJob,
  ClaudeSession,
  DisplayStatus,
  GitDetails,
  Health,
  Identity,
  ClaudeAuthStatus,
  ClaudeAccountList,
  Inbox,
  InboxItem,
  ListeningPorts,
  LogLine,
  ProcessInfo,
  Project,
  SandboxStatus,
  StatusEvent,
  SyncChanges,
  SyncRequest,
  TerminalInfo,
  Ticket,
  UsageReport,
} from "./index";
import { DEFAULT_ANDROID_STREAM } from "./constants";

const TS = "2026-09-23T10:00:00.000Z";
const LATER = "2026-09-23T10:05:00.000Z";

export const sampleHealth: Health = { ok: true, version: "0.1.0", protocolVersion: 1, sandboxId: "theone-sandbox" };

export const sampleTicket: Ticket = { ticket: "tkt_4d2c9b1e0f3a", expiresAt: "2026-09-23T10:01:00.000Z" };

export const sampleDisplay: DisplayStatus = {
  display: ":1",
  available: true,
  width: 1600,
  height: 900,
  vnc: { available: true, port: 5901, password: "vncpass1" },
  webPath: "/ui/vnc",
};

export const sampleStatus: SandboxStatus = {
  sandboxId: "theone-sandbox",
  hostname: "sandbox",
  version: "0.1.0",
  startedAt: TS,
  uptimeSec: 3600,
  resources: {
    cpu: { cores: 8, load1: 0.42, load5: 0.3, load15: 0.25 },
    memory: { totalBytes: 16_000_000_000, usedBytes: 4_000_000_000 },
    disk: { path: "/workspace", totalBytes: 500_000_000_000, usedBytes: 120_000_000_000 },
  },
  display: sampleDisplay,
  tools: [
    { name: "node", version: "24.1.0" },
    { name: "wine", version: "10.0" },
    { name: "claude", version: null },
  ],
  counts: { projects: 2, runningProcesses: 1, activeBuilds: 1, terminals: 1, agentRuns: 0 },
};

export const sampleContext: AgentContext = {
  files: [
    {
      name: "CURRENT_TASK.md",
      path: "/workspace/.agent/CURRENT_TASK.md",
      sizeBytes: 42,
      modifiedAt: TS,
      truncated: false,
      content: "# Current task\n\nBuild the Windows installer.\n",
    },
  ],
};

export const sampleClaudeAuthStatus: ClaudeAuthStatus = {
  available: true,
  method: "oauth_token",
  loggedIn: true,
  sources: { oauthToken: true, credentials: false, apiKey: false },
  oauthTokenFromEnv: false,
  account: { email: "dev@example.com", displayName: "Dev", organization: "Example" },
  subscriptionType: "max",
  credentialsExpiresAt: null,
  settingsPresent: true,
  configDir: "/home/dev/.claude",
  importedAt: "2026-01-01T00:00:00.000Z",
};

export const sampleClaudeAccountList: ClaudeAccountList = {
  defaultAccountId: "claude",
  accounts: [
    {
      id: "claude",
      primary: true,
      present: true,
      loggedIn: true,
      account: { email: "dev@example.com", displayName: "Dev", organization: "Example" },
      subscriptionType: "max",
      credentialsExpiresAt: "2026-01-01T08:00:00.000Z",
      settingsPresent: true,
      configDir: "/home/dev/.claude",
    },
    {
      id: "claude-work",
      primary: false,
      present: true,
      loggedIn: true,
      account: { email: "dev@work.example", displayName: "Dev", organization: "Work" },
      subscriptionType: "team",
      credentialsExpiresAt: "2026-01-01T08:00:00.000Z",
      settingsPresent: true,
      configDir: "/home/dev/.claude-work",
    },
  ],
};

export const sampleIdentity: Identity = {
  sandboxId: "theone-sandbox",
  tailscale: {
    available: true,
    source: "localapi",
    tailnet: "tail1234.ts.net",
    viewer: {
      id: "1234567890",
      loginName: "you@example.com",
      displayName: "You",
      profilePicUrl: "https://lh3.googleusercontent.com/a/example",
    },
    viewerNode: {
      hostName: "pixel-9",
      dnsName: "pixel-9.tail1234.ts.net",
      os: "android",
      tailscaleIps: ["100.64.0.2", "fd7a:115c:a1e0::2"],
      online: true,
    },
    owner: {
      id: "1234567890",
      loginName: "you@example.com",
      displayName: "You",
      profilePicUrl: null,
    },
    node: {
      hostName: "workstation",
      dnsName: "workstation.tail1234.ts.net",
      os: "linux",
      tailscaleIps: ["100.64.0.1", "fd7a:115c:a1e0::1"],
      online: true,
    },
  },
};

export const samplePorts: ListeningPorts = {
  tailscaleIp: "100.64.0.1",
  ports: [
    {
      port: 3000,
      pid: 4242,
      command: "node",
      processId: "prc_7f3k2q9xa1",
      projectId: "electron-hello",
      url: "http://100.64.0.1:3000",
      dnsUrl: "http://workstation.tail1234.ts.net:3000",
    },
    {
      port: 8080,
      pid: 4300,
      command: "python3",
      processId: null,
      projectId: null,
      url: "http://100.64.0.1:8080",
      dnsUrl: "http://workstation.tail1234.ts.net:8080",
    },
  ],
};

export const sampleProject: Project = {
  id: "electron-hello",
  name: "electron-hello",
  path: "/workspace/projects/electron-hello",
  framework: "electron",
  packageManager: "npm",
  scripts: ["start", "build"],
  dependenciesInstalled: true,
  buildTargets: ["electron-linux", "electron-windows"],
  git: {
    branch: "main",
    dirty: false,
    ahead: 0,
    behind: 0,
    lastCommit: { sha: "3f2a9c1", subject: "Initial commit", date: TS },
  },
  confidential: false,
  claudeAccountId: null,
};

export const sampleGitDetails: GitDetails = {
  branch: "main",
  ahead: 1,
  behind: 0,
  files: [{ path: "src/main.js", index: " ", worktree: "M" }],
  log: [{ sha: "3f2a9c1", subject: "Initial commit", author: "dev", date: TS }],
};

export const sampleLogLine: LogLine = { seq: 1, ts: TS, stream: "stdout", text: "Compiling…" };

export const sampleProcess: ProcessInfo = {
  id: "prc_7f3k2q9x0a",
  projectId: "electron-hello",
  name: "dev",
  command: "npm run start",
  cwd: "/workspace/projects/electron-hello",
  pid: 4242,
  port: null,
  display: true,
  state: "running",
  exitCode: null,
  startedAt: TS,
  endedAt: null,
};

export const sampleTerminal: TerminalInfo = {
  id: "trm_1a2b3c4d5e",
  kind: "shell",
  projectId: null,
  title: "bash",
  cwd: "/workspace",
  pid: 5151,
  cols: 80,
  rows: 24,
  state: "running",
  exitCode: null,
  createdAt: TS,
};

export const sampleArtifact: Artifact = {
  id: "art_9z8y7x6w5v",
  projectId: "electron-hello",
  buildId: "bld_7f3k2q9x0a",
  fileName: "electron-hello-windows-release-1.0.0.exe",
  path: "/workspace/artifacts/electron-hello-windows-release-1.0.0.exe",
  sizeBytes: 73_400_320,
  sha256: "a".repeat(64),
  platform: "windows",
  source: "build",
  agentRunId: null,
  note: null,
  createdAt: LATER,
};

export const sampleBuild: BuildJob = {
  id: "bld_7f3k2q9x0a",
  projectId: "electron-hello",
  target: "electron-windows",
  profile: "release",
  state: "succeeded",
  stage: "collect",
  progress: 1,
  startedAt: TS,
  endedAt: LATER,
  createdAt: TS,
  artifacts: [sampleArtifact],
  error: null,
};

export const sampleUpload: Upload = {
  id: "upl_a1s2d3f4g5",
  name: "screenshot.png",
  mimeType: "image/png",
  kind: "image",
  sizeBytes: 48_213,
  path: "/workspace/.theone/uploads/upl_a1s2d3f4g5/screenshot.png",
  createdAt: TS,
};

export const sampleTranscription: Transcription = {
  uploadId: "upl_a1s2d3f4g5",
  text: "Build the Windows installer",
  language: "en",
  durationMs: 2_400,
  engine: "whisper.cpp",
  fallbackReason: null,
};

export const sampleSttStatus: SttStatus = {
  profile: "eco",
  profiles: [
    { id: "off", model: null, threads: 0, nice: 0, available: true },
    { id: "eco", model: "base", threads: 2, nice: 19, available: true },
    { id: "balanced", model: "base", threads: 2, nice: 10, available: true },
    { id: "performance", model: "small", threads: 4, nice: 0, available: true },
  ],
  engine: "whisper.cpp",
  ready: true,
  reason: null,
  model: "base",
  cpus: 8,
  busy: false,
  queued: 0,
  gemini: { configured: false, model: "gemini-2.5-flash", source: null },
};

export const sampleAgentRun: AgentRun = {
  id: "run_q1w2e3r4t5",
  projectId: "electron-hello",
  prompt: "Build the Windows installer",
  mode: "bypassPermissions",
  attachments: [sampleUpload],
  sessionId: "5f0c2d7e-9d1b-4f6a-8a3e-2b7c1d0e9f11",
  claudeAccountId: "claude",
  state: "running",
  startedAt: TS,
  endedAt: null,
  usage: null,
  result: null,
  error: null,
  archivedAt: null,
};

export const sampleAgentRunEvents: AgentRunEvent[] = [
  { kind: "system", seq: 0, ts: TS, text: "session started" },
  { kind: "text", seq: 1, ts: TS, text: "Starting the build." },
  { kind: "tool_use", seq: 2, ts: TS, tool: "Bash", summary: "npx electron-builder --win nsis --x64" },
  { kind: "tool_result", seq: 3, ts: TS, tool: "Bash", isError: false, summary: "Build succeeded" },
];

export const sampleAgentRunDetail: AgentRunDetail = { ...sampleAgentRun, events: sampleAgentRunEvents };

export const sampleStatusEvent: StatusEvent = {
  project: "electron-hello",
  status: "building",
  platform: "windows",
  stage: "package",
  message: "Packaging NSIS installer",
  ts: TS,
};

const USAGE_DAY = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, messages: 0, sessions: 0 };

export const sampleUsageReport: UsageReport = {
  generatedAt: LATER,
  from: "2026-09-22T00:00:00.000Z",
  to: LATER,
  days: 2,
  totals: {
    inputTokens: 1200,
    outputTokens: 3400,
    cacheReadTokens: 56000,
    cacheWriteTokens: 7800,
    totalTokens: 68400,
    messages: 12,
    sessions: 2,
  },
  daily: [
    { date: "2026-09-22", ...USAGE_DAY },
    {
      date: "2026-09-23",
      inputTokens: 1200,
      outputTokens: 3400,
      cacheReadTokens: 56000,
      cacheWriteTokens: 7800,
      totalTokens: 68400,
      messages: 12,
      sessions: 2,
    },
  ],
  models: [
    { model: "claude-opus-4-5", inputTokens: 1000, outputTokens: 3000, cacheReadTokens: 50000, cacheWriteTokens: 7000, totalTokens: 61000, messages: 10 },
    { model: "claude-haiku-4-5", inputTokens: 200, outputTokens: 400, cacheReadTokens: 6000, cacheWriteTokens: 800, totalTokens: 7400, messages: 2 },
  ],
  projects: [
    {
      projectId: "electron-hello",
      inputTokens: 1000,
      outputTokens: 3000,
      cacheReadTokens: 50000,
      cacheWriteTokens: 7000,
      totalTokens: 61000,
      messages: 10,
      sessions: 1,
    },
    { projectId: null, inputTokens: 200, outputTokens: 400, cacheReadTokens: 6000, cacheWriteTokens: 800, totalTokens: 7400, messages: 2, sessions: 1 },
  ],
};

export const sampleClaudeSession: ClaudeSession = {
  sessionId: "ba4ddfd2-862d-49b0-8d2f-3d809897c89c",
  claudeAccountId: "claude",
  projectId: "electron-hello",
  cwd: "/workspace/projects/electron-hello",
  title: "Add a dark mode toggle to the settings screen",
  preview: "Done. The toggle lives in Settings → Appearance and persists across restarts.",
  model: "claude-opus-4-5",
  startedAt: TS,
  lastActiveAt: LATER,
  messages: 10,
  usage: { inputTokens: 1000, outputTokens: 3000, cacheReadTokens: 50000, cacheWriteTokens: 7000, totalTokens: 61000 },
  source: "agent-run",
  agentRunId: "run_q1w2e3r4t5",
  terminalId: null,
  active: false,
};

export const sampleInboxItem: InboxItem = {
  id: "inb_4k2m9q7x1a",
  kind: "permission",
  title: "Claude needs permission",
  body: "Claude needs your permission to use Bash",
  projectId: "electron-hello",
  sessionId: "5b0f6a3e-2c1d-4e8f-9a7b-1c2d3e4f5a6b",
  agentRunId: null,
  terminalId: "trm_9x8y7z6w5v",
  artifactId: null,
  createdAt: TS,
  updatedAt: "2026-09-23T10:02:00.000Z",
  readAt: null,
};

export const sampleInbox: Inbox = {
  items: [
    sampleInboxItem,
    {
      ...sampleInboxItem,
      id: "inb_7h3n5p2r8s",
      kind: "completed",
      title: "Claude finished",
      body: "All tests pass.",
      agentRunId: "run_2b8d4f6h0j",
      terminalId: null,
      updatedAt: TS,
      readAt: "2026-09-23T10:03:00.000Z",
    },
  ],
  unreadCount: 1,
  attentionCount: 1,
};

export const sampleSyncChanges: SyncChanges = {
  projectId: "electron-hello",
  baselineAt: TS,
  changes: [
    { path: "src/main.ts", kind: "modified", sha256: "a".repeat(64), size: 1204 },
    { path: "src/new-file.ts", kind: "added", sha256: "b".repeat(64), size: 320 },
    { path: "README.old.md", kind: "deleted", sha256: null, size: null },
  ],
  totalBytes: 1524,
  host: { name: "workstation", lastSeenAt: LATER, online: true, linked: true },
};

export const sampleSyncRequest: SyncRequest = {
  id: "sync_7m3k9p2q4r",
  projectId: "electron-hello",
  kind: "pull",
  status: "applied",
  paths: null,
  force: false,
  source: "mobile",
  claimedBy: "workstation",
  result: { added: 1, modified: 1, deleted: 1, conflicts: [], snapshotId: "20260923T100500Z", hostPath: "/home/me/code/electron-hello" },
  error: null,
  createdAt: TS,
  updatedAt: LATER,
};

export const sampleRunTargets: RunTargetInfo[] = [
  { target: "flutter-web", label: "Web", dir: null, available: true, reason: null, viewer: "url", actions: ["reload", "restart"] },
  { target: "flutter-linux", label: "Linux desktop", dir: null, available: true, reason: null, viewer: "display", actions: ["reload", "restart", "focus"] },
  {
    target: "flutter-android",
    label: "Android emulator",
    dir: null,
    available: false,
    reason: "Link the host Android emulator first",
    viewer: "android",
    actions: ["reload", "restart"],
  },
  { target: "test", label: "Tests", dir: null, available: true, reason: null, viewer: "none", actions: [] },
];

export const sampleAppRun: AppRun = {
  id: "app_4n8c2v6x1z",
  projectId: "flutter-hello",
  target: "flutter-web",
  dir: null,
  state: "ready",
  port: 8090,
  processIds: ["prc_9d2f6h1k3m"],
  viewer: { kind: "url", url: "http://100.64.0.2:8090", localUrl: "http://127.0.0.1:8090" },
  actions: ["reload", "restart"],
  error: null,
  startedAt: TS,
  readyAt: LATER,
  endedAt: null,
};

export const sampleExpoAppRun: AppRun = {
  ...sampleAppRun,
  id: "app_7q1w5e9r3t",
  projectId: "expo-hello",
  target: "expo-device",
  port: 8081,
  processIds: ["prc_2b4n6m8p0q"],
  viewer: {
    kind: "deeplink",
    devClientUrl: "exp+expo-hello://expo-development-client/?url=http%3A%2F%2F100.64.0.2%3A8081",
    expoGoUrl: "exp://100.64.0.2:8081",
    manifestUrl: "http://100.64.0.2:8081",
  },
};

export const sampleEmulator: EmulatorInfo = {
  state: "running",
  avd: "Pixel_8_API_35",
  serial: "127.0.0.1:41555",
  managed: true,
  isolated: true,
  width: 1080,
  height: 2400,
  startedAt: TS,
  error: null,
};

export const sampleAndroidLink: AndroidLinkInfo = {
  configured: true,
  sandboxUrl: "http://100.64.0.2:7700",
  connected: true,
  lastError: null,
};

export const sampleHostAndroidStatus: HostAndroidStatus = {
  available: true,
  reason: null,
  sdkRoot: "/home/me/.local/share/theone/android-sdk",
  isolation: "netns",
  avds: ["Pixel_8_API_35"],
  scrcpy: true,
  ffmpeg: true,
  emulator: sampleEmulator,
  link: sampleAndroidLink,
  stream: { ...DEFAULT_ANDROID_STREAM },
  devices: [
    { serial: "127.0.0.1:41555", state: "device", kind: "emulator", model: "sdk gphone64 x86 64", hostEmulator: true },
    { serial: "192.168.56.101:5555", state: "device", kind: "genymotion", model: "Google Pixel 3", hostEmulator: false },
  ],
};

export const sampleSandboxAndroidStatus: SandboxAndroidStatus = {
  linked: true,
  hostId: "workstation",
  emulator: sampleEmulator,
  adbSerial: "127.0.0.1:15555",
  adbConnected: true,
};
