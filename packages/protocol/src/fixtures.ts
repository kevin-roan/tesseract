import type {
  AgentContext,
  AgentRun,
  AgentRunDetail,
  AgentRunEvent,
  Artifact,
  BuildJob,
  DisplayStatus,
  GitDetails,
  Health,
  LogLine,
  ProcessInfo,
  Project,
  SandboxStatus,
  StatusEvent,
  TerminalInfo,
  Ticket,
} from "./index";

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

export const sampleProject: Project = {
  id: "electron-hello",
  name: "electron-hello",
  path: "/workspace/projects/electron-hello",
  framework: "electron",
  packageManager: "npm",
  scripts: ["start", "build"],
  buildTargets: ["electron-linux", "electron-windows"],
  git: {
    branch: "main",
    dirty: false,
    ahead: 0,
    behind: 0,
    lastCommit: { sha: "3f2a9c1", subject: "Initial commit", date: TS },
  },
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

export const sampleAgentRun: AgentRun = {
  id: "run_q1w2e3r4t5",
  projectId: "electron-hello",
  prompt: "Build the Windows installer",
  sessionId: "5f0c2d7e-9d1b-4f6a-8a3e-2b7c1d0e9f11",
  state: "running",
  startedAt: TS,
  endedAt: null,
  costUsd: null,
  result: null,
  error: null,
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
