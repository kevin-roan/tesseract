import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import {
  AGENT_SESSION_ID_PATTERN,
  AgentContextSchema,
  AgentRunDetailSchema,
  AgentRunEventSchema,
  AgentRunSchema,
  AgentStreamMessageSchema,
  ArtifactSchema,
  BuildJobSchema,
  CreateProjectResponseSchema,
  CreateProjectSchema,
  CreateTerminalSchema,
  DisplayStatusSchema,
  ErrorBodySchema,
  EventsClientMessageSchema,
  GitDetailsSchema,
  HealthSchema,
  IdentitySchema,
  ListeningPortsSchema,
  LogLineSchema,
  LogStreamMessageSchema,
  LogTailQuerySchema,
  ProcessInfoSchema,
  ProcessLogStreamMessageSchema,
  ProjectFilterQuerySchema,
  ProjectSchema,
  SandboxStatusSchema,
  ServerEventSchema,
  SttStatusSchema,
  UpdateSttSchema,
  StartAgentRunSchema,
  ArchiveAgentRunsSchema,
  AgentRunQuerySchema,
  DeleteAgentRunsSchema,
  StartBuildSchema,
  StartProcessSchema,
  StatusEventInputSchema,
  StatusEventSchema,
  TerminalClientMessageSchema,
  TerminalInfoSchema,
  TerminalServerMessageSchema,
  TicketSchema,
  IslandStateSchema,
  type IslandState,
  LIVE_ACTIVITY_TOKEN_KINDS,
  LiveActivityTokenSchema,
  RegisterLiveActivitySchema,
} from "../src/index";
import {
  sampleAgentRun,
  sampleAgentRunDetail,
  sampleAgentRunEvents,
  sampleArtifact,
  sampleBuild,
  sampleContext,
  sampleDisplay,
  sampleGitDetails,
  sampleHealth,
  sampleIdentity,
  sampleLogLine,
  samplePorts,
  sampleProcess,
  sampleProject,
  sampleStatus,
  sampleStatusEvent,
  sampleSttStatus,
  sampleTerminal,
  sampleTicket,
} from "../src/fixtures";

function roundTrip<T extends z.ZodType>(schema: T, value: unknown) {
  const parsed = schema.parse(JSON.parse(JSON.stringify(value)));
  expect(parsed as unknown).toEqual(value);
  return parsed;
}

function rejects(schema: z.ZodType, value: unknown) {
  expect(schema.safeParse(value).success).toBe(false);
}

describe("response schemas round-trip", () => {
  const cases: Array<[string, z.ZodType, unknown]> = [
    ["Health", HealthSchema, sampleHealth],
    ["Ticket", TicketSchema, sampleTicket],
    ["DisplayStatus", DisplayStatusSchema, sampleDisplay],
    ["SandboxStatus", SandboxStatusSchema, sampleStatus],
    ["AgentContext", AgentContextSchema, sampleContext],
    ["Identity", IdentitySchema, sampleIdentity],
    [
      "Identity without tailscale",
      IdentitySchema,
      {
        sandboxId: "sandbox",
        tailscale: { available: false, source: "none", tailnet: null, viewer: null, viewerNode: null, owner: null, node: null },
      },
    ],
    ["ListeningPorts", ListeningPortsSchema, samplePorts],
    [
      "ListeningPorts without tailscale",
      ListeningPortsSchema,
      { tailscaleIp: null, ports: [{ port: 5173, pid: 10, command: "vite", processId: null, projectId: null, url: null, dnsUrl: null }] },
    ],
    ["Project", ProjectSchema, sampleProject],
    ["GitDetails", GitDetailsSchema, sampleGitDetails],
    ["LogLine", LogLineSchema, sampleLogLine],
    ["ProcessInfo", ProcessInfoSchema, sampleProcess],
    ["ProcessInfo argv", ProcessInfoSchema, { ...sampleProcess, command: ["npm", "start"] }],
    ["TerminalInfo", TerminalInfoSchema, sampleTerminal],
    ["Artifact", ArtifactSchema, sampleArtifact],
    ["BuildJob", BuildJobSchema, sampleBuild],
    ["AgentRun", AgentRunSchema, sampleAgentRun],
    [
      "AgentRun with usage",
      AgentRunSchema,
      {
        ...sampleAgentRun,
        state: "succeeded",
        endedAt: sampleAgentRun.startedAt,
        usage: { inputTokens: 12, outputTokens: 340, cacheReadTokens: 5600, cacheWriteTokens: 78, totalTokens: 6030 },
      },
    ],
    ["AgentRunDetail", AgentRunDetailSchema, sampleAgentRunDetail],
    ["StatusEvent", StatusEventSchema, sampleStatusEvent],
    ["CreateProjectResponse", CreateProjectResponseSchema, { project: sampleProject, processId: "prc_abc123" }],
    ["CreateProjectResponse without process", CreateProjectResponseSchema, { project: sampleProject }],
    ["ErrorBody", ErrorBodySchema, { error: { code: "not_found", message: "No such project" } }],
    ["SttStatus", SttStatusSchema, sampleSttStatus],
    ["SttStatus off", SttStatusSchema, { ...sampleSttStatus, profile: "off", engine: null, ready: false, reason: "Speech-to-text is off", model: null }],
    ["stt.updated event", ServerEventSchema, { type: "stt.updated", stt: sampleSttStatus }],
  ];
  for (const [name, schema, value] of cases) {
    test(name, () => {
      roundTrip(schema, value);
    });
  }

  test("every AgentRunEvent kind", () => {
    for (const event of sampleAgentRunEvents) roundTrip(AgentRunEventSchema, event);
  });

  test("git dates with offsets and nullable git summary", () => {
    roundTrip(ProjectSchema, { ...sampleProject, git: null, packageManager: null });
    const withOffset = {
      ...sampleGitDetails,
      log: [{ sha: "abc", subject: "x", author: "a", date: "2026-09-23T12:00:00+02:00" }],
    };
    roundTrip(GitDetailsSchema, withOffset);
  });

  test("unknown fields are stripped for forward compatibility", () => {
    const parsed = HealthSchema.parse({ ...sampleHealth, extra: 1 });
    expect(parsed).toEqual(sampleHealth);
  });
});

describe("response schemas reject bad payloads", () => {
  test("Identity", () => {
    rejects(IdentitySchema, { ...sampleIdentity, tailscale: { ...sampleIdentity.tailscale, source: "whois" } });
    rejects(IdentitySchema, { ...sampleIdentity, tailscale: { ...sampleIdentity.tailscale, owner: undefined } });
  });
  test("ListeningPorts", () => {
    const [port] = samplePorts.ports;
    rejects(ListeningPortsSchema, { ...samplePorts, ports: [{ ...port, port: 70000 }] });
    rejects(ListeningPortsSchema, { ...samplePorts, ports: [{ ...port, processId: "bld_123" }] });
    rejects(ListeningPortsSchema, { ...samplePorts, ports: [{ ...port, url: undefined }] });
    rejects(ListeningPortsSchema, { ports: samplePorts.ports });
  });
  test("Health", () => {
    rejects(HealthSchema, { ...sampleHealth, protocolVersion: 2 });
    rejects(HealthSchema, { ...sampleHealth, ok: false });
  });
  test("timestamps must be ISO-8601", () => {
    rejects(TicketSchema, { ticket: "t", expiresAt: "tomorrow" });
    rejects(ProcessInfoSchema, { ...sampleProcess, startedAt: 1_700_000_000 });
  });
  test("ids must carry their prefix", () => {
    rejects(ProcessInfoSchema, { ...sampleProcess, id: "bld_123" });
    rejects(BuildJobSchema, { ...sampleBuild, id: "prc_123" });
    rejects(ArtifactSchema, { ...sampleArtifact, buildId: "nope" });
  });
  test("enums", () => {
    rejects(ProcessInfoSchema, { ...sampleProcess, state: "zombie" });
    rejects(ProjectSchema, { ...sampleProject, framework: "rails" });
    rejects(BuildJobSchema, { ...sampleBuild, target: "ios" });
    rejects(TerminalInfoSchema, { ...sampleTerminal, kind: "zsh" });
    rejects(ErrorBodySchema, { error: { code: "teapot", message: "x" } });
  });
  test("numbers", () => {
    rejects(BuildJobSchema, { ...sampleBuild, progress: 42 });
    rejects(ArtifactSchema, { ...sampleArtifact, sizeBytes: -1 });
    rejects(ArtifactSchema, { ...sampleArtifact, sha256: "xyz" });
    rejects(DisplayStatusSchema, { ...sampleDisplay, vnc: { ...sampleDisplay.vnc, port: 70000 } });
    rejects(LogLineSchema, { ...sampleLogLine, seq: 1.5 });
  });
  test("SttStatus", () => {
    rejects(SttStatusSchema, { ...sampleSttStatus, profile: "turbo" });
    rejects(SttStatusSchema, { ...sampleSttStatus, engine: "vosk" });
    rejects(SttStatusSchema, { ...sampleSttStatus, cpus: 0 });
    rejects(SttStatusSchema, { ...sampleSttStatus, queued: -1 });
    rejects(UpdateSttSchema, { profile: "max" });
    rejects(UpdateSttSchema, {});
    expect(UpdateSttSchema.parse({ profile: "balanced" })).toEqual({ profile: "balanced" });
  });
  test("missing required fields", () => {
    const { artifacts: _artifacts, ...withoutArtifacts } = sampleBuild;
    rejects(BuildJobSchema, withoutArtifacts);
    rejects(DisplayStatusSchema, { ...sampleDisplay, webPath: "/vnc" });
    rejects(AgentRunEventSchema, { kind: "tool_use", seq: 1, ts: sampleLogLine.ts, tool: "Bash" });
  });
});

describe("request schemas", () => {
  test("CreateProject", () => {
    expect(CreateProjectSchema.parse({ name: " My App " })).toEqual({ name: "My App" });
    roundTrip(CreateProjectSchema, { name: "app", gitUrl: "https://github.com/a/b.git", branch: "feature/x" });
    roundTrip(CreateProjectSchema, { name: "app", gitUrl: "git@github.com:a/b.git" });
    rejects(CreateProjectSchema, { name: "" });
    rejects(CreateProjectSchema, { name: "!!!" });
    rejects(CreateProjectSchema, { name: "app", gitUrl: "--upload-pack=evil" });
    rejects(CreateProjectSchema, { name: "app", branch: "-f" });
    rejects(CreateProjectSchema, { name: "app", branch: "a..b" });
  });

  test("StartProcess", () => {
    roundTrip(StartProcessSchema, { projectId: "app", command: "npm run dev", display: true, port: 5173 });
    roundTrip(StartProcessSchema, { projectId: "app", command: ["node", "server.js"], env: { PORT: "3000" } });
    expect(StartProcessSchema.parse({ projectId: "MyApp", command: "ls" }).projectId).toBe("myapp");
    rejects(StartProcessSchema, { projectId: "app", command: "   " });
    rejects(StartProcessSchema, { projectId: "app", command: [] });
    rejects(StartProcessSchema, { projectId: "app", command: ["", "x"] });
    rejects(StartProcessSchema, { projectId: "app", command: "ls", env: { "BAD-NAME": "x" } });
    rejects(StartProcessSchema, { projectId: "../etc", command: "ls" });
  });

  test("CreateTerminal", () => {
    roundTrip(CreateTerminalSchema, { kind: "claude", projectId: "app", cols: 120, rows: 40 });
    rejects(CreateTerminalSchema, { kind: "shell", cols: 0, rows: 24 });
    rejects(CreateTerminalSchema, { kind: "shell", cols: 80 });
  });

  test("StartBuild", () => {
    roundTrip(StartBuildSchema, { projectId: "app", target: "electron-windows", profile: "release" });
    roundTrip(StartBuildSchema, { projectId: "app", target: "android-apk" });
    rejects(StartBuildSchema, { projectId: "app", target: "electron-windows", profile: "prod" });
  });

  test("StartAgentRun", () => {
    roundTrip(StartAgentRunSchema, { prompt: "fix the build", projectId: "app", resumeSessionId: "abc" });
    roundTrip(StartAgentRunSchema, { prompt: "go on", resumeSessionId: "0f8c2a1e-5b7d-4c3e-9a41-2d6f8e0b1c3a" });
    roundTrip(StartAgentRunSchema, { prompt: "go on", resumeSessionId: `a${"b".repeat(255)}` });
    expect(StartAgentRunSchema.parse({ prompt: "go on", resumeSessionId: "  sess_1.2  " }).resumeSessionId).toBe("sess_1.2");
    rejects(StartAgentRunSchema, { prompt: "   " });
    for (const resumeSessionId of ["", "--dangerously-skip-permissions", "-x", ".hidden", "a b", "id;rm", "ü", `a${"b".repeat(256)}`]) {
      rejects(StartAgentRunSchema, { prompt: "go on", resumeSessionId });
    }
  });

  test("archive and delete agent runs", () => {
    const ids = [sampleAgentRun.id];
    roundTrip(ArchiveAgentRunsSchema, { ids, archived: true });
    roundTrip(ArchiveAgentRunsSchema, { all: true, archived: false, projectId: "app" });
    roundTrip(DeleteAgentRunsSchema, { ids });
    roundTrip(DeleteAgentRunsSchema, { all: true, archived: true });
    roundTrip(AgentRunQuerySchema, { projectId: "app", archived: "1" });
    rejects(ArchiveAgentRunsSchema, { ids });
    rejects(ArchiveAgentRunsSchema, { ids: [], archived: true });
    rejects(ArchiveAgentRunsSchema, { ids: ["bld_1234567890"], archived: true });
    rejects(ArchiveAgentRunsSchema, { all: false, archived: true });
    rejects(ArchiveAgentRunsSchema, { ids: Array.from({ length: 501 }, () => sampleAgentRun.id), archived: true });
    rejects(DeleteAgentRunsSchema, { ids: [] });
    rejects(DeleteAgentRunsSchema, { all: true, archived: "yes" });
    rejects(DeleteAgentRunsSchema, {});
    rejects(AgentRunQuerySchema, { archived: "maybe" });
    rejects(AgentRunSchema, { ...sampleAgentRun, archivedAt: undefined });
    rejects(AgentRunSchema, { ...sampleAgentRun, usage: undefined });
    rejects(AgentRunSchema, { ...sampleAgentRun, usage: { inputTokens: -1, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0 } });
    rejects(AgentRunSchema, { ...sampleAgentRun, usage: { inputTokens: 1.5, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0 } });
  });

  test("AGENT_SESSION_ID_PATTERN is the resumeSessionId rule", () => {
    expect(AGENT_SESSION_ID_PATTERN.test("sess-old")).toBe(true);
    expect(AGENT_SESSION_ID_PATTERN.test("-sess")).toBe(false);
    expect(AGENT_SESSION_ID_PATTERN.test("x".repeat(257))).toBe(false);
  });

  test("StatusEventInput", () => {
    const { ts: _ts, ...input } = sampleStatusEvent;
    roundTrip(StatusEventInputSchema, input);
    roundTrip(StatusEventInputSchema, { project: null, status: "idle", message: "" });
    expect(StatusEventInputSchema.parse({ ...input, ts: "ignored" })).toEqual(input);
    rejects(StatusEventInputSchema, { status: "idle", message: "x" });
  });

  test("queries", () => {
    expect(LogTailQuerySchema.parse({ tail: "200" })).toEqual({ tail: 200 });
    expect(LogTailQuerySchema.parse({})).toEqual({});
    rejects(LogTailQuerySchema, { tail: "abc" });
    rejects(LogTailQuerySchema, { tail: "999999" });
    expect(ProjectFilterQuerySchema.parse({ projectId: "App" })).toEqual({ projectId: "app" });
  });
});

describe("websocket messages", () => {
  test("terminal", () => {
    roundTrip(TerminalClientMessageSchema, { type: "input", data: "ls\r" });
    roundTrip(TerminalClientMessageSchema, { type: "resize", cols: 100, rows: 30 });
    roundTrip(TerminalServerMessageSchema, { type: "output", data: "\u001b[32mok\u001b[0m" });
    roundTrip(TerminalServerMessageSchema, { type: "exit", code: 0 });
    roundTrip(TerminalServerMessageSchema, { type: "exit", code: null });
    rejects(TerminalClientMessageSchema, { type: "resize", cols: 100 });
    rejects(TerminalServerMessageSchema, { type: "input", data: "x" });
  });

  test("log streams", () => {
    roundTrip(ProcessLogStreamMessageSchema, { type: "log", line: sampleLogLine });
    roundTrip(LogStreamMessageSchema, { type: "exit", code: 1 });
    roundTrip(LogStreamMessageSchema, { type: "build", build: sampleBuild });
    rejects(ProcessLogStreamMessageSchema, { type: "build", build: sampleBuild });
    rejects(LogStreamMessageSchema, { type: "log", line: { ...sampleLogLine, stream: "stdin" } });
  });

  test("agent stream", () => {
    roundTrip(AgentStreamMessageSchema, { type: "event", event: sampleAgentRunEvents[1] });
    roundTrip(AgentStreamMessageSchema, { type: "run", run: sampleAgentRun });
    rejects(AgentStreamMessageSchema, { type: "event", event: { kind: "thinking" } });
  });

  test("server events", () => {
    const events = [
      { type: "hello", protocolVersion: 1, sandboxId: "theone-sandbox" },
      { type: "ping" },
      { type: "status", event: sampleStatusEvent },
      { type: "process.updated", process: sampleProcess },
      { type: "terminal.updated", terminal: sampleTerminal },
      { type: "build.updated", build: sampleBuild },
      { type: "artifact.created", artifact: sampleArtifact },
      { type: "agent.updated", run: sampleAgentRun },
      { type: "agent.deleted", ids: [sampleAgentRun.id] },
      { type: "project.updated", project: sampleProject },
    ];
    for (const event of events) roundTrip(ServerEventSchema, event);
    rejects(ServerEventSchema, { type: "hello", protocolVersion: 2, sandboxId: "x" });
    rejects(ServerEventSchema, { type: "unknown" });
    rejects(ServerEventSchema, { type: "build.updated", build: { id: "bld_x" } });
    roundTrip(EventsClientMessageSchema, { type: "pong" });
  });
});

describe("live activity schemas", () => {
  const token = "a".repeat(64);
  const state: IslandState = {
    sandboxId: "sandbox",
    sandboxName: "dev-box",
    runs: [{ id: "run_1", title: "Fix the tests", project: "app", state: "running", startedAt: "2026-09-30T10:00:00.000Z", tokens: null }],
    commands: [{ id: "prc_1", label: "npm run dev", project: "app", state: "running" }],
    usage: { todayTokens: 10, weekTokens: 20, runsToday: 1, messagesToday: 2 },
    updatedAt: "2026-09-30T10:00:01.000Z",
  };

  test("IslandState round-trips and rejects unknown run states", () => {
    expect(IslandStateSchema.parse(state)).toEqual(state);
    expect(IslandStateSchema.safeParse({ ...state, runs: [{ ...state.runs[0], state: "succeeded" }] }).success).toBe(false);
    expect(IslandStateSchema.safeParse({ ...state, usage: { ...state.usage, todayTokens: -1 } }).success).toBe(false);
  });

  test("RegisterLiveActivity defaults activityId and checks the hex token", () => {
    expect(RegisterLiveActivitySchema.parse({ kind: "push-to-start", token })).toEqual({ kind: "push-to-start", token, activityId: null });
    expect(RegisterLiveActivitySchema.parse({ kind: "activity", token: token.toUpperCase(), activityId: "act-1" }).activityId).toBe("act-1");
    expect(RegisterLiveActivitySchema.safeParse({ kind: "activity", token: "xyz" }).success).toBe(false);
    expect(RegisterLiveActivitySchema.safeParse({ kind: "activity", token: "0".repeat(31) }).success).toBe(false);
    expect(RegisterLiveActivitySchema.safeParse({ kind: "activity", token: "0".repeat(513) }).success).toBe(false);
    expect(RegisterLiveActivitySchema.safeParse({ kind: "other", token }).success).toBe(false);
    expect(LIVE_ACTIVITY_TOKEN_KINDS).toEqual(["activity", "push-to-start"]);
  });

  test("LiveActivityToken needs timestamps", () => {
    const record = { kind: "activity" as const, token, activityId: null, createdAt: state.updatedAt, updatedAt: state.updatedAt };
    expect(LiveActivityTokenSchema.parse(record)).toEqual(record);
    expect(LiveActivityTokenSchema.safeParse({ kind: "activity", token, activityId: null }).success).toBe(false);
  });
});
