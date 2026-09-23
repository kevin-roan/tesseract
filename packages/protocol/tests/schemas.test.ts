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
  LogLineSchema,
  LogStreamMessageSchema,
  LogTailQuerySchema,
  ProcessInfoSchema,
  ProcessLogStreamMessageSchema,
  ProjectFilterQuerySchema,
  ProjectSchema,
  SandboxStatusSchema,
  ServerEventSchema,
  StartAgentRunSchema,
  StartBuildSchema,
  StartProcessSchema,
  StatusEventInputSchema,
  StatusEventSchema,
  TerminalClientMessageSchema,
  TerminalInfoSchema,
  TerminalServerMessageSchema,
  TicketSchema,
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
  sampleLogLine,
  sampleProcess,
  sampleProject,
  sampleStatus,
  sampleStatusEvent,
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
    ["Project", ProjectSchema, sampleProject],
    ["GitDetails", GitDetailsSchema, sampleGitDetails],
    ["LogLine", LogLineSchema, sampleLogLine],
    ["ProcessInfo", ProcessInfoSchema, sampleProcess],
    ["ProcessInfo argv", ProcessInfoSchema, { ...sampleProcess, command: ["npm", "start"] }],
    ["TerminalInfo", TerminalInfoSchema, sampleTerminal],
    ["Artifact", ArtifactSchema, sampleArtifact],
    ["BuildJob", BuildJobSchema, sampleBuild],
    ["AgentRun", AgentRunSchema, sampleAgentRun],
    ["AgentRunDetail", AgentRunDetailSchema, sampleAgentRunDetail],
    ["StatusEvent", StatusEventSchema, sampleStatusEvent],
    ["CreateProjectResponse", CreateProjectResponseSchema, { project: sampleProject, processId: "prc_abc123" }],
    ["CreateProjectResponse without process", CreateProjectResponseSchema, { project: sampleProject }],
    ["ErrorBody", ErrorBodySchema, { error: { code: "not_found", message: "No such project" } }],
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
      { type: "project.updated", project: sampleProject },
    ];
    for (const event of events) roundTrip(ServerEventSchema, event);
    rejects(ServerEventSchema, { type: "hello", protocolVersion: 2, sandboxId: "x" });
    rejects(ServerEventSchema, { type: "unknown" });
    rejects(ServerEventSchema, { type: "build.updated", build: { id: "bld_x" } });
    roundTrip(EventsClientMessageSchema, { type: "pong" });
  });
});
