import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  AgentRunSchema,
  InboxCountsSchema,
  InboxSchema,
  ServerEventSchema,
  type AgentRun,
  type Inbox,
  type InboxItem,
  type ServerEvent,
} from "@tesseract/protocol";
import { runCli, type Output } from "../src/cli/commands";
import { EventHub } from "../src/core/events";
import { silentLogger } from "../src/core/logger";
import { openDatabase } from "../src/db/database";
import { Repositories } from "../src/db/repositories";
import { lastAssistantText, notificationAction } from "../src/services/claude-hooks";
import { InboxService, snippet } from "../src/services/inbox";
import { installFakeClaude, makeTempDir, removeTempDirs, startTestController, TEST_TOKEN, waitFor, writeFiles, type TestController } from "./helpers";

afterAll(removeTempDirs);

function inboxFixture(keep?: number) {
  const repos = new Repositories(openDatabase(join(makeTempDir("inbox-db"), "controller.db")));
  const hub = new EventHub(silentLogger);
  const events: ServerEvent[] = [];
  hub.subscribe((event) => events.push(event));
  const inbox = new InboxService(repos, hub, silentLogger, keep);
  inbox.follow(hub);
  return { repos, hub, events, inbox };
}

function endedRun(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    id: "run_abc",
    projectId: "app",
    prompt: "fix the tests",
    mode: null,
    attachments: [],
    sessionId: "sess-1",
    claudeAccountId: null,
    state: "succeeded",
    startedAt: "2024-01-01T00:00:00.000Z",
    endedAt: "2024-01-01T00:01:00.000Z",
    usage: null,
    result: "All green",
    error: null,
    archivedAt: null,
    ...overrides,
  };
}

describe("InboxService", () => {
  test("adds items, counts attention and publishes inbox.updated", () => {
    const { inbox, events } = inboxFixture();
    const item = inbox.add({ kind: "permission", title: "Claude needs permission", body: "Bash: rm -rf dist", sessionId: "sess-1", projectId: "app" });
    expect(item).toMatchObject({ kind: "permission", projectId: "app", sessionId: "sess-1", agentRunId: null, terminalId: null, readAt: null });
    expect(item.id).toMatch(/^inb_/);
    inbox.add({ kind: "status", title: "Quota", body: "resumed" });
    expect(inbox.counts()).toEqual({ unreadCount: 2, attentionCount: 1 });
    const updates = events.filter((event) => event.type === "inbox.updated");
    expect(updates).toHaveLength(2);
    expect(ServerEventSchema.parse(updates[0])).toMatchObject({ item: { id: item.id }, unreadCount: 1, attentionCount: 1 });
  });

  test("bumps an unread repeat of the same kind and session instead of inserting", async () => {
    const { inbox } = inboxFixture();
    const first = inbox.add({ kind: "needs_input", title: "Waiting", body: "one", sessionId: "sess-1", terminalId: "trm_1" });
    await Bun.sleep(5);
    const second = inbox.add({ kind: "needs_input", title: "Waiting", body: "two", sessionId: "sess-1" });
    expect(second.id).toBe(first.id);
    expect(second).toMatchObject({ body: "two", createdAt: first.createdAt, terminalId: "trm_1" });
    expect(second.updatedAt > first.updatedAt).toBe(true);
    expect(inbox.list().items).toHaveLength(1);

    inbox.add({ kind: "permission", title: "Permission", body: "x", sessionId: "sess-1" });
    inbox.add({ kind: "needs_input", title: "Waiting", body: "other", sessionId: "sess-2" });
    expect(inbox.list().items).toHaveLength(3);

    inbox.markRead({ ids: [first.id] });
    const third = inbox.add({ kind: "needs_input", title: "Waiting", body: "three", sessionId: "sess-1" });
    expect(third.id).not.toBe(first.id);
    expect(third.terminalId).toBe("trm_1");
  });

  test("completed and failed share one item per session or run", () => {
    const { inbox } = inboxFixture();
    const stop = inbox.add({ kind: "completed", title: "Claude finished", body: "hook", sessionId: "sess-1" });
    const failed = inbox.add({ kind: "failed", title: "Claude run failed", body: "boom", sessionId: "sess-1", agentRunId: "run_abc" });
    expect(failed).toMatchObject({ id: stop.id, kind: "failed", agentRunId: "run_abc" });
    const again = inbox.add({ kind: "completed", title: "Claude finished", body: "later", agentRunId: "run_abc" });
    expect(again.id).toBe(stop.id);
    expect(inbox.list().items).toHaveLength(1);
  });

  test("clearAttention marks only that session's needs_input and permission items read", () => {
    const { inbox, events } = inboxFixture();
    inbox.add({ kind: "permission", title: "p", body: "", sessionId: "sess-1" });
    inbox.add({ kind: "needs_input", title: "n", body: "", sessionId: "sess-1" });
    inbox.add({ kind: "completed", title: "c", body: "", sessionId: "sess-1" });
    inbox.add({ kind: "permission", title: "p", body: "", sessionId: "sess-2" });
    events.length = 0;
    expect(inbox.clearAttention({ sessionId: "sess-1", agentRunId: null })).toBe(2);
    expect(inbox.counts()).toEqual({ unreadCount: 2, attentionCount: 1 });
    expect(events).toEqual([{ type: "inbox.updated", unreadCount: 2, attentionCount: 1 }]);
    expect(inbox.clearAttention({ sessionId: "sess-1", agentRunId: null })).toBe(0);
    expect(inbox.clearAttention({ sessionId: null, agentRunId: null })).toBe(0);
    expect(events).toHaveLength(1);
  });

  test("list filters unread, honours the limit and orders by updatedAt", async () => {
    const { inbox } = inboxFixture();
    const a = inbox.add({ kind: "status", title: "a", body: "", sessionId: "a" });
    await Bun.sleep(2);
    const b = inbox.add({ kind: "status", title: "b", body: "", sessionId: "b" });
    await Bun.sleep(2);
    inbox.add({ kind: "status", title: "a2", body: "", sessionId: "a" });
    expect(inbox.list().items.map((item) => item.id)).toEqual([a.id, b.id]);
    expect(inbox.list({ limit: 1 }).items.map((item) => item.id)).toEqual([a.id]);
    inbox.markRead({ ids: [a.id, "inb_unknown"] });
    expect(inbox.list({ unread: "1" }).items.map((item) => item.id)).toEqual([b.id]);
    expect(inbox.list({ unread: "false" }).items).toHaveLength(2);
    expect(InboxSchema.parse(inbox.list())).toMatchObject({ unreadCount: 1, attentionCount: 0 });
    expect(inbox.markRead({ all: true })).toEqual({ unreadCount: 0, attentionCount: 0 });
  });

  test("keeps only the newest items", () => {
    const { inbox } = inboxFixture(3);
    for (let index = 0; index < 5; index += 1) inbox.add({ kind: "status", title: `s${index}`, body: "" });
    expect(inbox.list().items.map((item) => item.title)).toEqual(["s4", "s3", "s2"]);
  });

  test("agent run outcomes add completed or failed and clear attention", () => {
    const { inbox, hub } = inboxFixture();
    inbox.add({ kind: "permission", title: "p", body: "", sessionId: "sess-1" });
    hub.publish({ type: "agent.updated", run: endedRun({ state: "running", endedAt: null, result: null }) });
    expect(inbox.counts()).toEqual({ unreadCount: 1, attentionCount: 1 });

    hub.publish({ type: "agent.updated", run: endedRun() });
    const [done] = inbox.list({ unread: "1" }).items;
    expect(done).toMatchObject({ kind: "completed", title: "Claude finished", body: "All green", agentRunId: "run_abc", projectId: "app" });
    expect(inbox.counts()).toEqual({ unreadCount: 1, attentionCount: 0 });

    hub.publish({ type: "agent.updated", run: endedRun({ id: "run_def", sessionId: null, state: "running", endedAt: null, result: null }) });
    hub.publish({ type: "agent.updated", run: endedRun({ id: "run_def", sessionId: null, state: "failed", result: null, error: "x".repeat(400) }) });
    const failed = inbox.list().items.find((item) => item.agentRunId === "run_def");
    expect(failed).toMatchObject({ kind: "failed", title: "Claude run failed" });
    expect(failed?.body.length).toBeLessThanOrEqual(280);

    hub.publish({ type: "agent.updated", run: endedRun({ id: "run_ghi", sessionId: "sess-3", state: "running", endedAt: null, result: null }) });
    hub.publish({ type: "agent.updated", run: endedRun({ id: "run_ghi", sessionId: "sess-3", state: "cancelled" }) });
    expect(inbox.list().items.some((item) => item.agentRunId === "run_ghi")).toBe(false);
  });

  test("an agent run whose Stop item was already read is not posted twice", () => {
    const { inbox, hub } = inboxFixture();
    const stop = inbox.add({ kind: "completed", title: "Claude finished", body: "hook", sessionId: "sess-1", agentRunId: "run_abc" });
    inbox.markRead({ ids: [stop.id] });
    hub.publish({ type: "agent.updated", run: endedRun({ state: "running", endedAt: null, result: null }) });
    hub.publish({ type: "agent.updated", run: endedRun() });
    expect(inbox.list().items).toHaveLength(1);
    expect(inbox.counts().unreadCount).toBe(0);
  });

  test("archiving or unarchiving a finished run posts nothing", () => {
    const { inbox, hub } = inboxFixture();
    hub.publish({ type: "agent.updated", run: endedRun({ archivedAt: "2026-01-02T00:00:00.000Z" }) });
    hub.publish({ type: "agent.updated", run: endedRun() });
    expect(inbox.list().items).toHaveLength(0);
  });
});

describe("hook helpers", () => {
  test("notificationAction maps notification types", () => {
    expect(notificationAction("permission_prompt", "x")).toMatchObject({ kind: "permission" });
    expect(notificationAction("idle_prompt", "Claude is waiting for your input")).toMatchObject({ kind: "needs_input" });
    expect(notificationAction("elicitation_dialog", undefined)).toMatchObject({ kind: "needs_input" });
    expect(notificationAction("elicitation_response", undefined)).toBe("answered");
    expect(notificationAction("auth_success", undefined)).toBeNull();
    expect(notificationAction("quota_auto_resume_fired", undefined)).toMatchObject({ kind: "status" });
    expect(notificationAction(undefined, "Claude needs your permission to use Bash")).toMatchObject({ kind: "permission" });
    expect(notificationAction("something_new", "hello")).toMatchObject({ kind: "needs_input" });
    expect(notificationAction("constructor", "hello")).toMatchObject({ kind: "needs_input" });
  });

  test("lastAssistantText reads the last assistant text from the transcript tail", async () => {
    const dir = makeTempDir("transcript");
    const path = join(dir, "session.jsonl");
    const lines = [
      { type: "assistant", message: { content: [{ type: "text", text: "earlier" }] } },
      { type: "user", message: { content: "thanks" } },
      { type: "assistant", message: { content: [{ type: "text", text: "Done: " }, { type: "text", text: "all tests pass" }] } },
      { type: "assistant", message: { content: [{ type: "tool_use", name: "Bash" }] } },
    ];
    writeFileSync(path, `${"x".repeat(100)}\n${lines.map((line) => JSON.stringify(line)).join("\n")}\nnot json\n`);
    expect(await lastAssistantText(path)).toBe("Done: \nall tests pass");
    expect(await lastAssistantText(path, 30)).toBeNull();
    expect(await lastAssistantText(join(dir, "missing.jsonl"))).toBeNull();
    expect(await lastAssistantText(join(dir, "notes.txt"))).toBeNull();
  });

  test("snippet flattens whitespace and truncates", () => {
    expect(snippet("  a\n\n b  ")).toBe("a b");
    expect(snippet("abcdefghij", 5)).toBe("abcd…");
  });
});

describe("HTTP and CLI", () => {
  let t: TestController;
  let env: Record<string, string>;

  const hook = (body: Record<string, unknown>) => t.request("POST", "/v1/hooks/claude", body);
  const inbox = async (query = "") => InboxSchema.parse((await t.json<Inbox>("GET", `/v1/inbox${query}`)).body);
  const bySession = async (sessionId: string) => (await inbox()).items.filter((item) => item.sessionId === sessionId);

  beforeAll(async () => {
    const workspace = makeTempDir("inbox");
    writeFiles(workspace, { "projects/app/src/.keep": "" });
    const claude = installFakeClaude(makeTempDir("bin"));
    t = await startTestController({ workspace, env: { TESSERACT_CLAUDE_BIN: claude } });
    env = { TESSERACT_WORKSPACE: workspace, TESSERACT_HOST: "127.0.0.1", TESSERACT_PORT: String(t.controller.url.port), TESSERACT_TOKEN: TEST_TOKEN };
  });

  afterAll(async () => {
    await t.stop();
  });

  test("hook → item → list → mark read → counts, with events", async () => {
    const socket = await t.socket("/v1/events");
    const cwd = join(t.workspace, "projects", "app", "src");
    const response = await hook({
      hook_event_name: "Notification",
      session_id: "sess-http",
      cwd,
      notification_type: "permission_prompt",
      message: "Claude needs your permission to use Bash",
      tesseract_terminal_id: "trm_notlive",
    });
    expect(response.status).toBe(202);
    const event = await socket.waitFor<ServerEvent>((message) => message.type === "inbox.updated");
    expect(ServerEventSchema.parse(event)).toMatchObject({ type: "inbox.updated", unreadCount: 1, attentionCount: 1 });

    const [item] = await bySession("sess-http");
    expect(item).toMatchObject({
      kind: "permission",
      title: "Claude needs permission",
      body: "Claude needs your permission to use Bash",
      projectId: "app",
      terminalId: null,
      agentRunId: null,
      readAt: null,
    });

    expect((await hook({ hook_event_name: "UserPromptSubmit", session_id: "sess-http", cwd, prompt: "yes" })).status).toBe(202);
    expect((await inbox("?unread=1")).items.some((entry) => entry.id === item?.id)).toBe(false);

    expect((await hook({ hook_event_name: "Notification", session_id: "sess-http", cwd, notification_type: "idle_prompt", message: "waiting" })).status).toBe(202);
    expect((await hook({ hook_event_name: "Stop", session_id: "sess-http", cwd, last_assistant_message: "Refactored the\nparser." })).status).toBe(202);
    const items = await bySession("sess-http");
    expect(items.map((entry) => [entry.kind, entry.readAt === null])).toEqual([
      ["completed", true],
      ["needs_input", false],
      ["permission", false],
    ]);
    expect(items[0]?.body).toBe("Refactored the parser.");

    const read = await t.json("POST", "/v1/inbox/read", { ids: [items[0]?.id] });
    expect(read.status).toBe(200);
    expect(InboxCountsSchema.parse(read.body)).toEqual({ unreadCount: 0, attentionCount: 0 });
    socket.close();
  });

  test("Stop without a message falls back to the transcript, then the project", async () => {
    const transcript = join(makeTempDir("tr"), "t.jsonl");
    writeFileSync(transcript, `${JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "From the transcript" }] } })}\n`);
    const cwd = join(t.workspace, "projects", "app");
    await hook({ hook_event_name: "Stop", session_id: "sess-tr", cwd, transcript_path: transcript });
    await hook({ hook_event_name: "Stop", session_id: "sess-cwd", cwd });
    expect((await bySession("sess-tr"))[0]?.body).toBe("From the transcript");
    expect((await bySession("sess-cwd"))[0]?.body).toBe("app");
  });

  test("ignored events and invalid bodies", async () => {
    const before = (await inbox()).items.length;
    expect((await hook({ hook_event_name: "SubagentStop", session_id: "s" })).status).toBe(202);
    expect((await hook({ hook_event_name: "Notification", notification_type: "auth_success" })).status).toBe(202);
    expect((await inbox()).items.length).toBe(before);
    expect((await hook({ session_id: "s" })).status).toBe(400);
    expect((await t.json("POST", "/v1/inbox/read", { ids: [] })).status).toBe(400);
    expect((await t.json("POST", "/v1/inbox/read", { all: false })).status).toBe(400);
    expect((await t.json("GET", "/v1/inbox?limit=0")).status).toBe(400);
    const unauthorized = await fetch(`${t.baseUrl}/v1/hooks/claude`, { method: "POST", body: JSON.stringify({ hook_event_name: "Stop" }) });
    expect(unauthorized.status).toBe(401);
  });

  test("an agent run and the Stop hook of its session make one item", async () => {
    const { status, body } = await t.json("POST", "/v1/agent/runs", { projectId: "app", prompt: "hello" });
    expect(status).toBe(201);
    const run = AgentRunSchema.parse(body);
    const item = await waitFor(async () => (await inbox()).items.find((entry) => entry.agentRunId === run.id), 10_000);
    expect(item).toMatchObject({ kind: "completed", body: "All done", sessionId: "sess-fake-123", projectId: "app" });
    await hook({ hook_event_name: "Stop", session_id: "sess-fake-123", last_assistant_message: "All done" });
    const items = await bySession("sess-fake-123");
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe(item.id);
  });

  test("hooks of a running agent run are linked to it", async () => {
    const run = AgentRunSchema.parse((await t.json("POST", "/v1/agent/runs", { prompt: "slow please" })).body);
    await waitFor(async () => (await t.json<AgentRun>("GET", `/v1/agent/runs/${run.id}`)).body.sessionId === "sess-fake-123");
    await hook({ hook_event_name: "Notification", session_id: "sess-fake-123", notification_type: "permission_prompt", message: "Allow?" });
    const pending = (await inbox("?unread=true")).items.find((entry: InboxItem) => entry.kind === "permission" && entry.agentRunId === run.id);
    expect(pending).toBeDefined();
    await t.json("DELETE", `/v1/agent/runs/${run.id}`);
    await waitFor(async () => !(await inbox("?unread=1")).items.some((entry) => entry.id === pending?.id));
  });

  test("tesseract-controller hook forwards stdin with the terminal id and prints nothing", async () => {
    const terminal = (await t.json<{ id: string }>("POST", "/v1/terminals", { kind: "shell", cols: 80, rows: 24 })).body;
    const output = capture();
    const payload = { hook_event_name: "Notification", session_id: "sess-cli", notification_type: "idle_prompt", message: "waiting" };
    const code = await runCli(["hook"], { env: { ...env, TESSERACT_TERMINAL_ID: terminal.id }, output, readStdin: async () => JSON.stringify(payload) });
    expect(code).toBe(0);
    expect(output.lines).toEqual([]);
    expect((await bySession("sess-cli"))[0]).toMatchObject({ kind: "needs_input", terminalId: terminal.id });
    await t.json("DELETE", `/v1/terminals/${terminal.id}`);
  });

  test("tesseract-controller hook exits 0 quickly when the controller is down or the input is bad", async () => {
    const server = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
    const downPort = String(server.port);
    server.stop(true);
    const cases: Array<{ env: Record<string, string | undefined>; stdin: () => Promise<string> }> = [
      { env: { ...env, TESSERACT_PORT: downPort }, stdin: async () => '{"hook_event_name":"Stop"}' },
      { env: { ...env, TESSERACT_TOKEN: undefined, TESSERACT_TOKEN_FILE: "/nonexistent/token" }, stdin: async () => '{"hook_event_name":"Stop"}' },
      { env, stdin: async () => "not json" },
      { env, stdin: async () => "[1]" },
      { env: { ...env, TESSERACT_PORT: "banana" }, stdin: async () => "{}" },
      { env, stdin: () => new Promise<string>(() => {}) },
      { env, stdin: async () => Promise.reject(new Error("closed")) },
    ];
    for (const entry of cases) {
      const output = capture();
      const started = performance.now();
      expect(await runCli(["hook"], { env: entry.env, output, readStdin: entry.stdin })).toBe(0);
      expect(performance.now() - started).toBeLessThan(2_500);
      expect(output.lines).toEqual([]);
    }
  });

  test("the compiled entry point exits 0 with no output when nothing listens", async () => {
    const proc = Bun.spawn([process.execPath, join(import.meta.dir, "..", "src", "index.ts"), "hook"], {
      env: { ...process.env, TESSERACT_HOST: "127.0.0.1", TESSERACT_PORT: "1", TESSERACT_TOKEN: TEST_TOKEN, TESSERACT_WORKSPACE: makeTempDir("cli-ws") },
      stdin: new TextEncoder().encode('{"hook_event_name":"Stop","session_id":"x"}'),
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(await proc.exited).toBe(0);
    expect(await new Response(proc.stdout).text()).toBe("");
    expect(await new Response(proc.stderr).text()).toBe("");
  });
});

function capture(): Output & { lines: string[] } {
  const lines: string[] = [];
  return { lines, out: (text) => lines.push(text), err: (text) => lines.push(text) };
}
