import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { TCPSocketListener } from "bun";
import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import {
  DeletedProjectSchema,
  AgentContextSchema,
  AgentRunBatchResultSchema,
  AgentRunDetailSchema,
  AgentRunListSchema,
  AgentRunSchema,
  AgentStreamMessageSchema,
  AppRunListSchema,
  AppRunSchema,
  ArtifactListSchema,
  ArtifactSchema,
  BrowserStatusSchema,
  BuildJobSchema,
  BuildListSchema,
  ClaudeAuthStatusSchema,
  ClaudeImportResultSchema,
  ClaudeSessionListSchema,
  CreateProjectResponseSchema,
  DisplayStatusSchema,
  ERROR_STATUS,
  ErrorBodySchema,
  GitDetailsSchema,
  HealthSchema,
  InboxCountsSchema,
  InboxSchema,
  ListeningPortsSchema,
  LIMITS,
  LogLineListSchema,
  LogStreamMessageSchema,
  ProcessInfoSchema,
  ProcessListSchema,
  ProcessLogStreamMessageSchema,
  ProjectListSchema,
  ProjectSchema,
  PushDeviceSchema,
  RunTargetListSchema,
  SandboxAndroidStatusSchema,
  SandboxStatusSchema,
  SERVER_EVENT_TYPES,
  ServerEventSchema,
  STT_PROFILES,
  SttStatusSchema,
  SyncChangesSchema,
  SyncRequestListSchema,
  SyncRequestSchema,
  TaildropTargetsSchema,
  TerminalInfoSchema,
  TerminalListSchema,
  TerminalServerMessageSchema,
  TicketSchema,
  UploadSchema,
  UsageReportSchema,
  VNC_WS_SUBPROTOCOL,
  type ErrorCode,
  type Schema,
  type ServerEvent,
} from "@theone/protocol";
import { openDatabase } from "../src/db/database";
import { Repositories } from "../src/db/repositories";
import { installFakeClaude, makeTempDir, removeTempDirs, startTestController, upgradeStatus, waitFor, writeFiles, WsClient, type TestController } from "./helpers";

const RFB_GREETING = "RFB 003.008\n";

let t: TestController;
let events: WsClient;
let vnc: TCPSocketListener<undefined>;
let outside: string;

/** Strict conformance: parsing must succeed and must not strip or rewrite anything the server sent. */
function conforms<T>(schema: Schema<T>, value: unknown, what: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(`${what} does not match the protocol: ${result.error.message}\n${JSON.stringify(value).slice(0, 500)}`);
  expect(result.data as unknown).toEqual(value);
  return result.data;
}

async function rest<T>(schema: Schema<T>, method: string, path: string, body?: unknown, status = method === "POST" ? 201 : 200): Promise<T> {
  const response = await t.request(method, path, body);
  const text = await response.text();
  if (response.status !== status) throw new Error(`${method} ${path}: expected ${status}, got ${response.status} ${text}`);
  expect(response.headers.get("content-type")).toStartWith("application/json");
  return conforms(schema, JSON.parse(text), `${method} ${path}`);
}

async function restError(code: ErrorCode, response: Response, status: number = ERROR_STATUS[code]): Promise<void> {
  expect(response.status).toBe(status);
  expect(response.headers.get("content-type")).toStartWith("application/json");
  expect(conforms(ErrorBodySchema, await response.json(), `${response.url} error`).error.code).toBe(code);
}

function framesOf<T>(socket: WsClient, schema: Schema<T>, what: string): T[] {
  return socket.messages.map((message, index) => conforms(schema, message, `${what} frame ${index}`));
}

function git(dir: string, ...args: string[]): void {
  const result = Bun.spawnSync([
    "git",
    "-c", "user.name=Conformance",
    "-c", "user.email=conformance@example.invalid",
    "-c", "init.defaultBranch=main",
    "-c", "commit.gpgsign=false",
    "-c", "core.hooksPath=/dev/null",
    "-C", dir,
    ...args,
  ]);
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString()}`);
}

beforeAll(async () => {
  vnc = Bun.listen({
    hostname: "127.0.0.1",
    port: 0,
    socket: {
      open: (socket) => void socket.write(RFB_GREETING),
      data: (socket, data) => void socket.write(data),
    },
  });
  const workspace = makeTempDir("conformance");
  outside = makeTempDir("conformance-outside");
  const site = join(workspace, "projects", "site");
  writeFiles(site, {
    "package.json": JSON.stringify({
      name: "site",
      version: "1.2.3",
      scripts: { build: "mkdir -p dist && echo '<h1>ok</h1>' > dist/index.html && echo built", test: "echo ok" },
    }),
    "bun.lock": "{}",
  });
  git(site, "init", "-q");
  git(site, "add", ".");
  git(site, "commit", "-q", "-m", "initial commit");
  writeFiles(site, { "untracked.txt": "new\n" });
  writeFiles(workspace, { ".agent/CURRENT_TASK.md": "# Current Task\n" });
  mkdirSync(join(workspace, "projects"), { recursive: true });
  symlinkSync(outside, join(workspace, "projects", "escape"));

  t = await startTestController({
    workspace,
    env: {
      THEONE_CLAUDE_BIN: installFakeClaude(makeTempDir("conformance-bin")),
      THEONE_VNC_PORT: String(vnc.port),
      THEONE_VNC_PASSWORD: "vnc-pass",
      THEONE_STT_ENGINE: "none",
    },
    controller: { pingIntervalMs: 100 },
  });
  events = await t.socket("/v1/events");
});

afterAll(async () => {
  events.close();
  await t.stop();
  vnc.stop(true);
  removeTempDirs();
});

describe("REST responses match @theone/protocol", () => {
  test("system endpoints", async () => {
    const health = await fetch(`${t.baseUrl}/v1/health`);
    expect(health.status).toBe(200);
    conforms(HealthSchema, await health.json(), "GET /v1/health");

    const ticket = await rest(TicketSchema, "POST", "/v1/auth/ticket", undefined, 200);
    const ttl = Date.parse(ticket.expiresAt) - Date.now();
    expect(ttl).toBeGreaterThan(LIMITS.ticketTtlMs - 5_000);
    expect(ttl).toBeLessThanOrEqual(LIMITS.ticketTtlMs);

    const status = await rest(SandboxStatusSchema, "GET", "/v1/status");
    expect(status.display.vnc).toEqual({ available: true, port: vnc.port, password: "vnc-pass" });

    const context = await rest(AgentContextSchema, "GET", "/v1/context");
    expect(context.files.map((file) => file.name)).toContain("CURRENT_TASK.md");

    const ports = await rest(ListeningPortsSchema, "GET", "/v1/ports");
    const listed = ports.ports.map((entry) => entry.port);
    expect(listed).not.toContain(Number(t.controller.url.port));
    expect(listed).not.toContain(vnc.port);

    const usage = await rest(UsageReportSchema, "GET", "/v1/usage?days=3");
    expect(usage.daily).toHaveLength(3);
    await rest(ClaudeSessionListSchema, "GET", "/v1/sessions?limit=5");

    const claude = await rest(ClaudeAuthStatusSchema, "GET", "/v1/claude/auth");
    expect(claude).toMatchObject({ available: true, method: "none", configDir: t.config.claudeConfigDir });
    const imported = await rest(ClaudeImportResultSchema, "POST", "/v1/claude/import", { files: [{ path: "hooks.sh", content: "x" }] }, 200);
    expect(imported.skipped).toEqual([{ path: "hooks.sh", reason: "not an importable path" }]);

    await rest(DisplayStatusSchema, "GET", "/v1/display");
    await restError("unavailable", await t.request("GET", "/v1/display/screenshot"));
    expect(await rest(BrowserStatusSchema, "GET", "/v1/display/browser")).toEqual({ available: false, tabs: [] });
    await restError("unavailable", await t.request("GET", "/v1/display/windows"));
    await restError("bad_request", await t.request("POST", "/v1/display/windows/not-a-window/activate"));
    await restError("bad_request", await t.request("POST", "/v1/display/windows/0xZZ/close", { force: true }));
    await restError("bad_request", await t.request("POST", "/v1/display/windows/0x03a00004/close", { force: "yes" }));
    await restError("unavailable", await t.request("POST", "/v1/display/windows/0x03a00004/activate"));
    await restError("unavailable", await t.request("POST", "/v1/display/windows/0x03a00004/close"));

    const published = await t.request("POST", "/v1/events", { project: "site", status: "testing", message: "conformance" });
    expect(published.status).toBe(202);
    expect(await published.text()).toBe("");
  });

  test("projects", async () => {
    const list = await rest(ProjectListSchema, "GET", "/v1/projects");
    expect(list.map((project) => project.id)).toContain("site");
    const site = await rest(ProjectSchema, "GET", "/v1/projects/site");
    expect(site.git?.lastCommit?.subject).toBe("initial commit");
    const details = await rest(GitDetailsSchema, "GET", "/v1/projects/site/git");
    expect(details.files).toContainEqual({ path: "untracked.txt", index: "?", worktree: "?" });

    const created = await rest(CreateProjectResponseSchema, "POST", "/v1/projects", { name: "Fresh App" });
    expect(created.project.id).toBe("fresh-app");
    expect(created.processId).toBeUndefined();
    await restError("conflict", await t.request("DELETE", "/v1/projects/fresh-app"));
    expect(await rest(DeletedProjectSchema, "DELETE", "/v1/projects/fresh-app?force=1")).toMatchObject({ id: "fresh-app" });

    const cloned = await rest(CreateProjectResponseSchema, "POST", "/v1/projects", { name: "copy", gitUrl: `file://${site.path}` });
    expect(cloned.processId).toStartWith("prc_");
    await waitFor(async () => (await rest(ProcessInfoSchema, "GET", `/v1/processes/${cloned.processId}`)).endedAt);

    await restError("conflict", await t.request("POST", "/v1/projects", { name: "copy" }));
    await restError("forbidden", await t.request("GET", "/v1/projects/escape"));
    await restError("not_found", await t.request("GET", "/v1/projects/ghost"));
    await restError("bad_request", await t.request("GET", "/v1/projects/..%2F..%2Fetc"));
  });

  test("processes", async () => {
    const started = await rest(ProcessInfoSchema, "POST", "/v1/processes", {
      projectId: "site",
      command: "echo conformance-out; echo conformance-err >&2",
    });
    await waitFor(async () => (await rest(ProcessInfoSchema, "GET", `/v1/processes/${started.id}`)).endedAt);
    const logs = await rest(LogLineListSchema, "GET", `/v1/processes/${started.id}/logs?tail=50`);
    expect(logs.map((line) => [line.stream, line.text])).toContainEqual(["stderr", "conformance-err"]);

    const long = await rest(ProcessInfoSchema, "POST", "/v1/processes", { projectId: "site", command: ["sleep", "30"], name: "sleeper" });
    const list = await rest(ProcessListSchema, "GET", "/v1/processes?projectId=site");
    expect(list.map((process) => process.id)).toContain(long.id);
    const stopped = await rest(ProcessInfoSchema, "DELETE", `/v1/processes/${long.id}`);
    expect(stopped.state).toBe("stopped");

    await restError("not_found", await t.request("GET", "/v1/processes/prc_missing0000"));
    await restError("bad_request", await t.request("POST", "/v1/processes", { projectId: "site" }));
  });

  test("app runs and the android link", async () => {
    const targets = await rest(RunTargetListSchema, "GET", "/v1/projects/site/run-targets");
    expect(targets).toEqual([{ target: "test", label: "Tests", dir: null, available: true, reason: null, viewer: "none", actions: [] }]);
    const started = await rest(AppRunSchema, "POST", "/v1/projects/site/app-runs", { target: "test" });
    expect(started).toMatchObject({ projectId: "site", target: "test", dir: null, state: "starting", port: null });
    const ended = await waitFor(async () => {
      const run = await rest(AppRunSchema, "GET", `/v1/app-runs/${started.id}`);
      return run.endedAt ? run : null;
    });
    expect(ended.state).toBe("exited");
    expect((await rest(AppRunListSchema, "GET", "/v1/app-runs?projectId=site")).map((run) => run.id)).toContain(started.id);
    expect((await rest(AppRunSchema, "DELETE", `/v1/app-runs/${started.id}`)).state).toBe("exited");
    await restError("conflict", await t.request("POST", `/v1/app-runs/${started.id}/actions`, { action: "reload" }));
    await restError("bad_request", await t.request("POST", "/v1/projects/site/app-runs", { target: "web-dev" }));
    await restError("not_found", await t.request("GET", "/v1/app-runs/app_missing000"));
    expect(await rest(SandboxAndroidStatusSchema, "GET", "/v1/android")).toEqual({
      linked: false,
      hostId: null,
      emulator: null,
      adbSerial: null,
      adbConnected: false,
    });
  });

  test("terminals", async () => {
    const created = await rest(TerminalInfoSchema, "POST", "/v1/terminals", { kind: "shell", projectId: "site", cols: 90, rows: 30 });
    const list = await rest(TerminalListSchema, "GET", "/v1/terminals");
    expect(list.map((terminal) => terminal.id)).toContain(created.id);
    const closed = await rest(TerminalInfoSchema, "DELETE", `/v1/terminals/${created.id}`);
    expect(closed.state).toBe("exited");
  });

  test("builds and artifacts", async () => {
    const queued = await rest(BuildJobSchema, "POST", "/v1/builds", { projectId: "site", target: "web" });
    const done = await waitFor(async () => {
      const build = await rest(BuildJobSchema, "GET", `/v1/builds/${queued.id}`);
      return build.endedAt ? build : null;
    }, 15_000);
    expect(done.state).toBe("succeeded");
    await rest(BuildListSchema, "GET", "/v1/builds?projectId=site");
    await rest(LogLineListSchema, "GET", `/v1/builds/${queued.id}/logs`);
    expect((await rest(BuildJobSchema, "DELETE", `/v1/builds/${queued.id}`)).state).toBe("succeeded");

    const artifacts = await rest(ArtifactListSchema, "GET", "/v1/artifacts?projectId=site");
    const artifact = artifacts.find((item) => item.buildId === queued.id);
    expect(artifact?.fileName).toBe("site-web-debug-1.2.3.zip");
    const download = await t.request("GET", `/v1/artifacts/${artifact?.id}/download`);
    expect(download.status).toBe(200);
    expect(download.headers.get("content-disposition")).toStartWith("attachment;");
    expect(download.headers.get("content-type")).toBe("application/zip");
    expect((await download.arrayBuffer()).byteLength).toBe(artifact?.sizeBytes ?? -1);

    const shared = await rest(ArtifactSchema, "POST", "/v1/artifacts", { path: join(t.workspace, "projects/site/untracked.txt"), note: "conformance" });
    expect(shared).toMatchObject({ source: "agent", projectId: "site", note: "conformance", buildId: null });
    const announced = await rest(InboxSchema, "GET", "/v1/inbox");
    expect(announced.items.find((item) => item.artifactId === shared.id)?.kind).toBe("file");
    expect(await rest(TaildropTargetsSchema, "GET", "/v1/taildrop/targets")).toEqual({ available: false, targets: [] });
    await restError("unavailable", await t.request("POST", `/v1/artifacts/${shared.id}/taildrop`, { targetId: "nPixel" }));
    expect((await rest(ArtifactSchema, "DELETE", `/v1/artifacts/${shared.id}`)).id).toBe(shared.id);
    await restError("not_found", await t.request("DELETE", `/v1/artifacts/${shared.id}`));
    const outside = makeTempDir("outside");
    writeFiles(outside, { "secret.txt": "x" });
    await restError("forbidden", await t.request("POST", "/v1/artifacts", { path: join(outside, "secret.txt"), projectId: "site" }));

    await restError("bad_request", await t.request("POST", "/v1/builds", { projectId: "site", target: "android-apk" }));
    await restError("not_found", await t.request("GET", "/v1/builds/bld_missing0000"));
  });

  test("agent runs", async () => {
    const run = await rest(AgentRunSchema, "POST", "/v1/agent/runs", { projectId: "site", prompt: "conformance" });
    const detail = await waitFor(async () => {
      const current = await rest(AgentRunDetailSchema, "GET", `/v1/agent/runs/${run.id}`);
      return current.state === "running" ? null : current;
    }, 10_000);
    expect(detail.events.length).toBeGreaterThan(0);
    await rest(AgentRunListSchema, "GET", "/v1/agent/runs?projectId=site");
    const cancelled = await rest(AgentRunSchema, "DELETE", `/v1/agent/runs/${run.id}`);
    expect(cancelled.state).toBe("succeeded");
    expect(await rest(AgentRunBatchResultSchema, "POST", "/v1/agent/runs/archive", { ids: [run.id], archived: true }, 200)).toEqual({ count: 1 });
    const archived = await rest(AgentRunListSchema, "GET", "/v1/agent/runs?archived=1&projectId=site");
    expect(archived.map((entry) => entry.id)).toEqual([run.id]);
    expect(await rest(AgentRunBatchResultSchema, "POST", "/v1/agent/runs/delete", { ids: [run.id] }, 200)).toEqual({ count: 1 });
    await restError("bad_request", await t.request("POST", "/v1/agent/runs/delete", { ids: [] }));
  });

  test("uploads, transcriptions and runs with attachments", async () => {
    const image = await rest(UploadSchema, "POST", "/v1/uploads", { name: "shot.png", mimeType: "image/png", data: "iVBORw0KGgo=" });
    expect(image.kind).toBe("image");
    const content = await t.request("GET", `/v1/uploads/${image.id}/content`);
    expect(content.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await content.arrayBuffer())).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    await restError("bad_request", await t.request("POST", "/v1/transcriptions", { uploadId: image.id }));
    await restError("not_found", await t.request("POST", "/v1/transcriptions", { uploadId: "upl_missing0000" }));
    const voice = await rest(UploadSchema, "POST", "/v1/uploads", { name: "note.m4a", mimeType: "audio/mp4", data: "AAAA" });
    await restError("unavailable", await t.request("POST", "/v1/transcriptions", { uploadId: voice.id }));
    const stt = await rest(SttStatusSchema, "GET", "/v1/stt");
    expect(stt.profiles.map((profile) => profile.id)).toEqual([...STT_PROFILES]);
    expect(await rest(SttStatusSchema, "PUT", "/v1/stt", { profile: "off" })).toMatchObject({ profile: "off", ready: false, engine: null });
    await restError("unavailable", await t.request("POST", "/v1/transcriptions", { uploadId: voice.id }));
    await restError("bad_request", await t.request("PUT", "/v1/stt", { profile: "turbo" }));
    expect((await rest(SttStatusSchema, "PUT", "/v1/stt", { profile: stt.profile })).profile).toBe(stt.profile);

    const run = await rest(AgentRunSchema, "POST", "/v1/agent/runs", { prompt: "look", mode: "plan", attachmentIds: [image.id, voice.id] });
    expect(run.attachments).toEqual([image, voice]);
    const detail = await waitFor(async () => {
      const current = await rest(AgentRunDetailSchema, "GET", `/v1/agent/runs/${run.id}`);
      return current.state === "running" ? null : current;
    }, 10_000);
    expect(detail).toMatchObject({ mode: "plan", attachments: [image, voice] });
  });

  test("errors for auth and oversized bodies", async () => {
    await restError("unauthorized", await fetch(`${t.baseUrl}/v1/status`));
    await restError("unauthorized", await fetch(`${t.baseUrl}/v1/status`, { headers: { Authorization: "Bearer wrong" } }));
    await restError("not_found", await t.request("GET", "/v1/nothing-here"));
    const huge = await t.request("POST", "/v1/events", JSON.stringify({ project: null, status: "x", message: "y".repeat(1_100_000) }));
    await restError("bad_request", huge, 413);
  });
});

describe("WebSocket frames match @theone/protocol", () => {
  test("process log stream", async () => {
    const info = await rest(ProcessInfoSchema, "POST", "/v1/processes", {
      projectId: "site",
      command: "for i in 1 2 3; do echo line-$i; sleep 0.05; done; exit 3",
    });
    const socket = await t.socket(`/v1/processes/${info.id}/logs/stream`);
    expect((await socket.closed).code).toBe(1000);
    const frames = framesOf(socket, ProcessLogStreamMessageSchema, "process log");
    expect(frames.at(-1)).toEqual({ type: "exit", code: 3 });
    expect(frames.slice(0, -1).every((frame) => frame.type === "log")).toBe(true);
    expect(frames.flatMap((frame) => (frame.type === "log" ? [frame.line.text] : []))).toContain("line-3");
  });

  test("build log stream", async () => {
    const queued = await rest(BuildJobSchema, "POST", "/v1/builds", { projectId: "site", target: "script" });
    const socket = await t.socket(`/v1/builds/${queued.id}/logs/stream`);
    expect((await socket.closed).code).toBe(1000);
    const frames = framesOf(socket, LogStreamMessageSchema, "build log");
    expect(frames.at(-1)).toEqual({ type: "exit", code: 0 });
    const builds = frames.flatMap((frame) => (frame.type === "build" ? [frame.build] : []));
    expect(builds.at(-1)?.state).toBe("succeeded");
    expect(frames.some((frame) => frame.type === "log" && frame.line.text === "built")).toBe(true);
  });

  test("terminal stream", async () => {
    const info = await rest(TerminalInfoSchema, "POST", "/v1/terminals", { kind: "shell", cols: 80, rows: 24 });
    const socket = await t.socket(`/v1/terminals/${info.id}/stream`);
    socket.send({ type: "resize", cols: 100, rows: 40 });
    socket.send({ type: "input", data: "echo ünïcødé-$((2+3)) 😀; exit 4\r" });
    expect((await socket.closed).code).toBe(1000);
    const frames = framesOf(socket, TerminalServerMessageSchema, "terminal");
    expect(frames.at(-1)).toEqual({ type: "exit", code: 4 });
    const output = frames.flatMap((frame) => (frame.type === "output" ? [frame.data] : [])).join("");
    expect(output).toContain("ünïcødé-5 😀");

    const late = await t.socket(`/v1/terminals/${info.id}/stream`);
    await late.closed;
    const replay = framesOf(late, TerminalServerMessageSchema, "terminal replay");
    expect(replay.map((frame) => frame.type)).toEqual(["output", "exit"]);
  });

  test("agent run stream", async () => {
    const run = await rest(AgentRunSchema, "POST", "/v1/agent/runs", { prompt: "stream please" });
    const socket = await t.socket(`/v1/agent/runs/${run.id}/stream`);
    expect((await socket.closed).code).toBe(1000);
    const frames = framesOf(socket, AgentStreamMessageSchema, "agent");
    const last = frames.at(-1);
    expect(last?.type === "run" && last.run.state).toBe("succeeded");
    const seqs = frames.flatMap((frame) => (frame.type === "event" ? [frame.event.seq] : []));
    expect(seqs).toEqual(seqs.map((_, index) => index + 1));
  });

  test("inbox and Claude hooks", async () => {
    const hook = await t.request("POST", "/v1/hooks/claude", {
      hook_event_name: "Notification",
      session_id: "sess-conformance",
      notification_type: "permission_prompt",
      message: "Claude needs your permission to use Bash",
    });
    expect(hook.status).toBe(202);
    expect(await hook.text()).toBe("");
    const inbox = await rest(InboxSchema, "GET", "/v1/inbox?unread=1&limit=10");
    const item = inbox.items.find((entry) => entry.sessionId === "sess-conformance");
    expect(item?.kind).toBe("permission");
    const counts = await rest(InboxCountsSchema, "POST", "/v1/inbox/read", { ids: [item?.id] }, 200);
    expect(counts.attentionCount).toBe(0);
    await restError("bad_request", await t.request("POST", "/v1/inbox/read", { ids: ["bld_x"] }));
  });

  test("sync back", async () => {
    const source = makeTempDir("conformance-sync");
    writeFiles(source, { "a.txt": "a\n", "b.txt": "b\n" });
    const archive = Bun.spawnSync(["tar", "-c", "-z", "-f", "-", "-C", source, "."], { stdout: "pipe" }).stdout;
    const pushed = await fetch(`${t.baseUrl}/v1/projects/mirror/sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t.controller.services.token}`, "Content-Type": "application/gzip" },
      body: archive,
    });
    conforms(ProjectSchema, await pushed.json(), "POST /v1/projects/mirror/sync");
    writeFiles(join(t.config.projectsDir, "mirror"), { "a.txt": "changed\n", "c.txt": "c\n" });

    expect((await t.request("POST", "/v1/sync/heartbeat", { host: "laptop", projects: ["mirror"] })).status).toBe(204);
    const changes = await rest(SyncChangesSchema, "GET", "/v1/projects/mirror/sync/changes");
    expect(changes.changes.map((change) => [change.kind, change.path])).toEqual([["modified", "a.txt"], ["added", "c.txt"]]);
    expect(changes.host).toMatchObject({ name: "laptop", online: true, linked: true });

    const exported = await t.request("POST", "/v1/projects/mirror/sync/export", { paths: ["a.txt", "c.txt"] });
    expect(exported.status).toBe(200);
    expect(exported.headers.get("content-type")).toBe("application/gzip");
    expect((await exported.arrayBuffer()).byteLength).toBeGreaterThan(0);
    await restError("bad_request", await t.request("POST", "/v1/projects/mirror/sync/export", { paths: ["b.txt"] }));

    const acked = await rest(SyncChangesSchema, "POST", "/v1/projects/mirror/sync/ack", { changes: [{ path: "c.txt", sha256: changes.changes[1]!.sha256 }] }, 200);
    expect(acked.changes.map((change) => change.path)).toEqual(["a.txt"]);

    const request = await rest(SyncRequestSchema, "POST", "/v1/projects/mirror/sync/requests", { kind: "pull" });
    await restError("conflict", await t.request("POST", "/v1/projects/mirror/sync/requests", { kind: "pull" }));
    expect((await rest(SyncRequestListSchema, "GET", "/v1/sync/requests?status=pending")).map((entry) => entry.id)).toContain(request.id);
    await rest(SyncRequestSchema, "POST", `/v1/sync/requests/${request.id}/claim`, { host: "laptop" }, 200);
    await restError("conflict", await t.request("POST", `/v1/sync/requests/${request.id}/cancel`));
    const result = { added: 0, modified: 1, deleted: 0, conflicts: [], snapshotId: "s1", hostPath: "/home/me/mirror" };
    await rest(SyncRequestSchema, "POST", `/v1/sync/requests/${request.id}/complete`, { status: "applied", result }, 200);
    const cancelled = await rest(SyncRequestSchema, "POST", "/v1/projects/mirror/sync/requests", { kind: "revert", source: "desktop" });
    expect((await rest(SyncRequestSchema, "POST", `/v1/sync/requests/${cancelled.id}/cancel`, undefined, 200)).status).toBe("cancelled");
    expect((await rest(SyncRequestListSchema, "GET", "/v1/projects/mirror/sync/requests")).map((entry) => entry.status)).toEqual(["cancelled", "applied"]);
    await restError("not_found", await t.request("POST", "/v1/sync/requests/sync_missing/claim", { host: "laptop" }));
  });

  test("push devices", async () => {
    const token = "ExponentPushToken[conformance]";
    const device = await rest(PushDeviceSchema, "POST", "/v1/push/devices", { token, platform: "android", name: "Pixel" }, 200);
    expect(device).toMatchObject({ token, platform: "android", name: "Pixel" });
    const listed = await t.json<unknown[]>("GET", "/v1/push/devices");
    expect(listed.body.map((entry) => PushDeviceSchema.parse(entry).token)).toContain(token);
    expect((await rest(PushDeviceSchema, "DELETE", `/v1/push/devices/${encodeURIComponent(token)}`)).token).toBe(token);
    await restError("not_found", await t.request("DELETE", `/v1/push/devices/${encodeURIComponent(token)}`));
    await restError("bad_request", await t.request("POST", "/v1/push/devices", { token: "nope", platform: "android" }));
  });

  test("VNC bridge is binary and echoes the subprotocol", async () => {
    const socket = await t.socket("/v1/display/vnc", [VNC_WS_SUBPROTOCOL]);
    expect(socket.ws.protocol).toBe(VNC_WS_SUBPROTOCOL);
    const greeting = await socket.waitFor<Uint8Array>((message) => message instanceof Uint8Array);
    expect(new TextDecoder().decode(greeting)).toBe(RFB_GREETING);
    socket.send(new TextEncoder().encode("RFB 003.008\n"));
    await socket.waitFor(() => socket.messages.length >= 2);
    expect(socket.messages.every((message) => message instanceof Uint8Array)).toBe(true);
    socket.close();
  });

  test("events stream carried every server event type", async () => {
    await waitFor(() => events.messages.some((message) => (message as ServerEvent).type === "artifact.created"));
    const frames = framesOf(events, ServerEventSchema, "event");
    expect(frames[0]).toEqual({ type: "hello", protocolVersion: 1, sandboxId: "test-sandbox" });
    expect(new Set(frames.map((frame) => frame.type))).toEqual(new Set(SERVER_EVENT_TYPES));
    const status = frames.find((frame) => frame.type === "status");
    expect(status?.type === "status" && status.event).toMatchObject({ project: "site", status: "testing", message: "conformance" });
  });
});

describe("after a restart", () => {
  test("interrupted work is ended, never re-run, and still conforms", async () => {
    const workspace = makeTempDir("conformance-restart");
    writeFiles(workspace, { "projects/app/package.json": JSON.stringify({ scripts: { build: "echo hi" } }) });
    const first = await startTestController({ workspace });
    const dbPath = first.config.dbPath;
    await first.stop();

    const startedAt = new Date().toISOString();
    const db = openDatabase(dbPath);
    const repos = new Repositories(db);
    const build = { projectId: "app", target: "script" as const, profile: "debug" as const, stage: null, progress: null, endedAt: null, createdAt: startedAt, error: null };
    repos.builds.save({ ...build, id: "bld_running0001", state: "running", stage: "compile", progress: 0.5, startedAt });
    repos.builds.save({ ...build, id: "bld_queued00001", state: "queued", startedAt: null });
    repos.agentRuns.save({ id: "run_running0001", projectId: "app", prompt: "p", mode: null, attachments: [], sessionId: "s", claudeAccountId: null, state: "running", startedAt, endedAt: null, usage: null, result: null, error: null, archivedAt: null });
    repos.appendAgentEvent("run_running0001", { kind: "text", seq: 1, ts: startedAt, text: "before the restart" });
    repos.terminals.save({ id: "trm_running0001", kind: "shell", projectId: null, title: "Shell", cwd: workspace, pid: 999_999, cols: 80, rows: 24, state: "running", exitCode: null, createdAt: startedAt });
    db.close();

    const second = await startTestController({ workspace });
    try {
      const get = async <T>(schema: Schema<T>, path: string) => conforms(schema, (await second.json("GET", path)).body, path);
      for (const id of ["bld_running0001", "bld_queued00001"]) {
        const recovered = await get(BuildJobSchema, `/v1/builds/${id}`);
        expect(recovered.state).toBe("failed");
        expect(recovered.endedAt).not.toBeNull();
        expect(recovered.error).toContain("restarted");
      }
      await Bun.sleep(200);
      expect((await get(BuildJobSchema, "/v1/builds/bld_queued00001")).state).toBe("failed");

      const buildStream = await second.socket("/v1/builds/bld_running0001/logs/stream");
      expect((await buildStream.closed).code).toBe(1000);
      expect(framesOf(buildStream, LogStreamMessageSchema, "recovered build").at(-1)).toEqual({ type: "exit", code: null });

      const run = await get(AgentRunDetailSchema, "/v1/agent/runs/run_running0001");
      expect(run.state).toBe("failed");
      expect(run.events.map((event) => event.seq)).toEqual([1]);
      const runStream = await second.socket("/v1/agent/runs/run_running0001/stream");
      expect((await runStream.closed).code).toBe(1000);
      expect(framesOf(runStream, AgentStreamMessageSchema, "recovered run").map((frame) => frame.type)).toEqual(["event", "run"]);

      expect((await get(TerminalListSchema, "/v1/terminals")).map((terminal) => terminal.id)).not.toContain("trm_running0001");
      expect((await upgradeStatus(`${second.wsBase}/v1/terminals/trm_running0001/stream?ticket=${await second.ticket()}`)).status).toBe(404);
      const closed = await second.request("DELETE", "/v1/terminals/trm_running0001");
      expect(conforms(TerminalInfoSchema, await closed.json(), "DELETE recovered terminal").state).toBe("exited");
    } finally {
      await second.stop();
    }
  });
});
