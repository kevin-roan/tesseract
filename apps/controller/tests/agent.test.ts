import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AgentRunDetailSchema, AgentRunSchema, AgentStreamMessageSchema, type AgentRun, type AgentRunEvent, type AgentStreamMessage } from "@theone/protocol";
import { AgentStreamParser, summarizeToolInput } from "../src/services/agent-stream";
import { claudeArgs } from "../src/services/agent-runs";
import { installFakeClaude, labelledPid, makeTempDir, processGone, removeTempDirs, startTestController, waitFor, writeFiles, type TestController } from "./helpers";

let t: TestController;

async function startRun(body: Record<string, unknown>): Promise<AgentRun> {
  const { status, body: run } = await t.json("POST", "/v1/agent/runs", body);
  if (status !== 201) throw new Error(`run failed to start: ${status} ${JSON.stringify(run)}`);
  return AgentRunSchema.parse(run);
}

beforeAll(async () => {
  const workspace = makeTempDir("agent");
  writeFiles(workspace, { "projects/app/.keep": "" });
  const claude = installFakeClaude(makeTempDir("bin"));
  t = await startTestController({ workspace, env: { THEONE_CLAUDE_BIN: claude, THEONE_CLAUDE_PERMISSION_MODE: "acceptEdits" } });
});

afterAll(async () => {
  await t.stop();
  removeTempDirs();
});

describe("headless runs", () => {
  test("streams mapped events and finishes with the result", async () => {
    const run = await startRun({ projectId: "app", prompt: "hello there" });
    expect(run).toMatchObject({ state: "running", projectId: "app", prompt: "hello there" });
    const socket = await t.socket(`/v1/agent/runs/${run.id}/stream`);
    const final = await socket.waitFor<AgentStreamMessage>((message) => message.type === "run" && message.run.state !== "running", 10_000);
    const messages = socket.messages.map((message) => AgentStreamMessageSchema.parse(message));
    const events = messages.flatMap((message) => (message.type === "event" ? [message.event] : []));

    expect(final.type === "run" && final.run).toMatchObject({
      state: "succeeded",
      sessionId: "sess-fake-123",
      costUsd: 0.0123,
      result: "All done",
      error: null,
    });
    expect(events.map((event) => event.seq)).toEqual(events.map((_, index) => index + 1));
    expect(events[0]).toMatchObject({ kind: "system", text: expect.stringContaining("model claude-test") });
    const args = events.find((event): event is Extract<AgentRunEvent, { kind: "text" }> => event.kind === "text" && event.text.startsWith("args:"));
    expect(args?.text).toBe("args: -p --output-format stream-json --verbose --permission-mode acceptEdits");
    expect(events).toContainEqual(expect.objectContaining({ kind: "text", text: "prompt length 11" }));
    expect(events).toContainEqual(expect.objectContaining({ kind: "tool_use", tool: "Bash", summary: "ls -la" }));
    expect(events).toContainEqual(expect.objectContaining({ kind: "tool_result", tool: "Bash", isError: false, summary: "file-a file-b" }));
    expect(events).toContainEqual(expect.objectContaining({ kind: "text", text: "split line" }));
    expect(events.at(-1)).toMatchObject({ kind: "system", text: expect.stringContaining("Run finished in 1.2 s") });
    expect((await socket.closed).code).toBe(1000);

    const detail = AgentRunDetailSchema.parse((await t.json("GET", `/v1/agent/runs/${run.id}`)).body);
    expect(detail.events).toEqual(events);
    const replay = await t.socket(`/v1/agent/runs/${run.id}/stream`);
    await replay.waitFor<AgentStreamMessage>((message) => message.type === "run");
    expect(replay.messages.filter((message) => (message as AgentStreamMessage).type === "event")).toHaveLength(events.length);
  });

  test("resumes sessions and passes long prompts on stdin", async () => {
    const long = "x".repeat(150_000);
    const run = await startRun({ prompt: long, resumeSessionId: "sess-old" });
    const done = await waitFor(async () => {
      const detail = AgentRunDetailSchema.parse((await t.json("GET", `/v1/agent/runs/${run.id}`)).body);
      return detail.state === "running" ? null : detail;
    }, 10_000);
    expect(done.state).toBe("succeeded");
    const texts = done.events.flatMap((event) => (event.kind === "text" ? [event.text] : []));
    expect(texts).toContain("prompt length 150000");
    expect(texts.find((text) => text.startsWith("args:"))).toContain("--resume sess-old");
    expect(done.projectId).toBeNull();
  });

  test("prompts that look like CLI options or subcommands are never parsed as arguments", async () => {
    for (const prompt of ["--mcp-config=/tmp/evil.json", "install"]) {
      const run = await startRun({ prompt });
      const done = await waitFor(async () => {
        const detail = AgentRunDetailSchema.parse((await t.json("GET", `/v1/agent/runs/${run.id}`)).body);
        return detail.state === "running" ? null : detail;
      }, 10_000);
      expect(done.state).toBe("succeeded");
      const texts = done.events.flatMap((event) => (event.kind === "text" ? [event.text] : []));
      expect(texts).toContain(`prompt length ${prompt.length}`);
      expect(texts.find((text) => text.startsWith("args:"))).not.toContain(prompt);
    }
  });

  test("rejects resume ids that could be parsed as options", async () => {
    for (const resumeSessionId of ["--dangerously-skip-permissions", "-x", "a b", "id;rm"]) {
      const { status, body } = await t.json<{ error: { code: string } }>("POST", "/v1/agent/runs", { prompt: "hi", resumeSessionId });
      expect(status).toBe(400);
      expect(body.error.code).toBe("bad_request");
    }
  });

  test("cancel kills the run", async () => {
    const run = await startRun({ projectId: "app", prompt: "slow please" });
    await waitFor(async () => AgentRunSchema.parse((await t.json("GET", `/v1/agent/runs/${run.id}`)).body).sessionId);
    const started = Date.now();
    const { status, body } = await t.json("DELETE", `/v1/agent/runs/${run.id}`);
    expect(status).toBe(200);
    expect(AgentRunSchema.parse(body).state).toBe("cancelled");
    expect(Date.now() - started).toBeLessThan(3_000);
  });

  test("a run without a result fails with stderr", async () => {
    const run = await startRun({ prompt: "fail now" });
    const done = await waitFor(async () => {
      const current = AgentRunSchema.parse((await t.json("GET", `/v1/agent/runs/${run.id}`)).body);
      return current.state === "running" ? null : current;
    }, 10_000);
    expect(done.state).toBe("failed");
    expect(done.error).toContain("boom: simulated failure");
  });

  test("processes a finished run leaves behind are stopped", async () => {
    const run = await startRun({ prompt: "leak a server" });
    const done = await waitFor(async () => {
      const current = AgentRunDetailSchema.parse((await t.json("GET", `/v1/agent/runs/${run.id}`)).body);
      return current.state === "running" ? null : current;
    }, 10_000);
    expect(done).toMatchObject({ state: "succeeded", result: "Started a server" });
    const texts = done.events.flatMap((event) => (event.kind === "text" || event.kind === "system" ? [event.text] : []));
    expect(processGone(labelledPid(texts.join("\n"), "leftover"))).toBe(true);
    expect(texts).toContainEqual(expect.stringMatching(/^Stopping 1 process left running in the process group: sleep \(\d+\)$/));
  });

  test("lists runs and filters by project", async () => {
    const all = (await t.json<AgentRun[]>("GET", "/v1/agent/runs")).body;
    expect(all.length).toBeGreaterThanOrEqual(4);
    const app = (await t.json<AgentRun[]>("GET", "/v1/agent/runs?projectId=app")).body;
    expect(app.every((run) => run.projectId === "app")).toBe(true);
  });

  test("is unavailable without Claude Code", async () => {
    const other = await startTestController();
    try {
      const { status, body } = await other.json<{ error: { code: string } }>("POST", "/v1/agent/runs", { prompt: "hi" });
      expect(status).toBe(503);
      expect(body.error.code).toBe("unavailable");
    } finally {
      await other.stop();
    }
  });
});

describe("stream-json parser", () => {
  test("ignores noise and maps results", () => {
    const parser = new AgentStreamParser();
    expect(parser.parseLine("")).toBeNull();
    expect(parser.parseLine("{broken")).toBeNull();
    expect(parser.parseLine('{"type":"stream_event","event":{}}')).toBeNull();
    const failure = parser.parseLine('{"type":"result","subtype":"error_max_turns","is_error":true,"total_cost_usd":1.5}');
    expect(failure?.result).toEqual({ isError: true, result: null, costUsd: 1.5, subtype: "error_max_turns" });
  });

  test("summarizes tool input", () => {
    expect(summarizeToolInput("Read", { file_path: "/workspace/a.ts" })).toBe("/workspace/a.ts");
    expect(summarizeToolInput("TodoWrite", { todos: [1, 2, 3] })).toBe("3 todos");
    expect(summarizeToolInput("Custom", { a: 1 })).toBe('{"a":1}');
    expect(summarizeToolInput("Bash", { command: `echo ${"y".repeat(300)}` }).length).toBe(200);
  });

  test("builds the claude command line with the prompt on stdin only", () => {
    expect(claudeArgs("--version", "bypassPermissions")).toEqual({
      argv: ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "bypassPermissions"],
      stdin: "--version",
    });
    const long = claudeArgs("z".repeat(200_000), "plan", "abc");
    expect(long.argv).toEqual(["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "plan", "--resume", "abc"]);
    expect(long.stdin.length).toBe(200_000);
  });
});
