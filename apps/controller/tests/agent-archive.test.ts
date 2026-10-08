import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AgentRunBatchResultSchema, AgentRunListSchema, AgentRunSchema, ServerEventSchema, type AgentRun, type ServerEvent } from "@tesseract/protocol";
import { installFakeClaude, makeTempDir, removeTempDirs, startTestController, waitFor, writeFiles, WsClient, type TestController } from "./helpers";

let t: TestController;
let events: WsClient;

async function finishedRun(projectId?: string): Promise<AgentRun> {
  const { status, body } = await t.json("POST", "/v1/agent/runs", { prompt: "hello", ...(projectId ? { projectId } : {}) });
  expect(status).toBe(201);
  const run = AgentRunSchema.parse(body);
  expect(run.archivedAt).toBeNull();
  return waitFor(async () => {
    const current = AgentRunSchema.parse((await t.json("GET", `/v1/agent/runs/${run.id}`)).body);
    return current.state === "running" ? null : current;
  }, 10_000);
}

async function list(query = ""): Promise<string[]> {
  const { status, body } = await t.json("GET", `/v1/agent/runs${query}`);
  expect(status).toBe(200);
  return AgentRunListSchema.parse(body).map((run) => run.id);
}

async function batch(path: string, body: unknown): Promise<number> {
  const { status, body: result } = await t.json("POST", `/v1/agent/runs/${path}`, body);
  expect(status).toBe(200);
  return AgentRunBatchResultSchema.parse(result).count;
}

const eventRows = (runId: string) =>
  t.controller.services.db.query<{ n: number }, [string]>("SELECT COUNT(*) AS n FROM agent_run_events WHERE run_id = ?").get(runId)?.n ?? 0;

const serverEvents = () => events.messages.map((message) => ServerEventSchema.parse(message));

beforeAll(async () => {
  const workspace = makeTempDir("agent-archive");
  writeFiles(workspace, { "projects/app/.keep": "", "projects/web/.keep": "" });
  const claude = installFakeClaude(makeTempDir("bin"));
  t = await startTestController({ workspace, env: { TESSERACT_CLAUDE_BIN: claude } });
  events = await t.socket("/v1/events");
});

afterAll(async () => {
  events.close();
  await t.stop();
  removeTempDirs();
});

describe("archiving and deleting agent runs", () => {
  test("archive, list filtering and unarchive", async () => {
    const a = await finishedRun("app");
    const b = await finishedRun("app");
    const c = await finishedRun("web");
    const inbox = (await t.json("GET", "/v1/inbox")).body;

    expect(await batch("archive", { ids: [a.id, b.id, "run_unknown000"], archived: true })).toBe(2);
    expect(await batch("archive", { ids: [a.id], archived: true })).toBe(0);
    const archivedEvent = await events.waitFor<ServerEvent>((event) => event.type === "agent.updated" && event.run.id === a.id && event.run.archivedAt !== null);
    expect(archivedEvent.type === "agent.updated" && archivedEvent.run.state).toBe("succeeded");

    expect(await list()).toEqual([c.id]);
    expect(await list("?archived=0")).toEqual([c.id]);
    expect(await list("?archived=false")).toEqual([c.id]);
    expect(new Set(await list("?archived=1"))).toEqual(new Set([a.id, b.id]));
    expect(new Set(await list("?archived=true&projectId=app"))).toEqual(new Set([a.id, b.id]));
    expect(await list("?archived=true&projectId=web")).toEqual([]);
    const detail = AgentRunSchema.parse((await t.json("GET", `/v1/agent/runs/${a.id}`)).body);
    expect(detail.archivedAt).not.toBeNull();

    expect(await batch("archive", { ids: [b.id], archived: false })).toBe(1);
    await events.waitFor<ServerEvent>((event) => event.type === "agent.updated" && event.run.id === b.id && event.run.archivedAt === null);
    expect(new Set(await list())).toEqual(new Set([b.id, c.id]));

    expect(await batch("archive", { all: true, archived: true, projectId: "web" })).toBe(1);
    expect(await list("?archived=1&projectId=web")).toEqual([c.id]);
    expect(await batch("archive", { all: true, archived: false })).toBe(2);
    expect(await list("?archived=1")).toEqual([]);
    expect((await t.json("GET", "/v1/inbox")).body).toEqual(inbox);
  });

  test("running runs are skipped", async () => {
    const { body } = await t.json("POST", "/v1/agent/runs", { prompt: "slow please" });
    const slow = AgentRunSchema.parse(body);
    try {
      expect(await batch("archive", { ids: [slow.id], archived: true })).toBe(0);
      expect(await batch("delete", { ids: [slow.id] })).toBe(0);
      await batch("archive", { all: true, archived: true });
      expect(await list()).toEqual([slow.id]);
      expect(await batch("delete", { all: true, archived: false })).toBe(0);
      expect(AgentRunSchema.parse((await t.json("GET", `/v1/agent/runs/${slow.id}`)).body).state).toBe("running");
      await batch("archive", { all: true, archived: false });
    } finally {
      await t.json("DELETE", `/v1/agent/runs/${slow.id}`);
    }
  });

  test("delete by ids removes runs, their events and inbox links", async () => {
    const run = await finishedRun("app");
    expect(eventRows(run.id)).toBeGreaterThan(0);
    const linked = t.controller.services.repos.inbox.where("agent_run_id = ?", run.id);
    expect(linked.length).toBeGreaterThan(0);

    expect(await batch("delete", { ids: [run.id, "run_unknown000"] })).toBe(1);
    const deleted = await events.waitFor<ServerEvent>((event) => event.type === "agent.deleted");
    expect(deleted).toEqual({ type: "agent.deleted", ids: [run.id] });
    expect((await t.json("GET", `/v1/agent/runs/${run.id}`)).status).toBe(404);
    expect(eventRows(run.id)).toBe(0);
    expect(t.controller.services.repos.inbox.get(linked[0]!.id)?.agentRunId).toBeNull();
    expect(await batch("delete", { ids: [run.id] })).toBe(0);
  });

  test("delete all, optionally only archived runs", async () => {
    const keep = await finishedRun("app");
    const old = await finishedRun("web");
    await batch("archive", { ids: [old.id], archived: true });

    const before = serverEvents().filter((event) => event.type === "agent.deleted").length;
    expect(await batch("delete", { all: true, archived: true, projectId: "app" })).toBe(0);
    expect(serverEvents().filter((event) => event.type === "agent.deleted")).toHaveLength(before);

    expect(await batch("delete", { all: true, archived: true })).toBe(1);
    expect(await list("?archived=1")).toEqual([]);
    expect(eventRows(old.id)).toBe(0);
    expect(await list()).toContain(keep.id);

    const remaining = (await list()).length;
    expect(await batch("delete", { all: true })).toBe(remaining);
    expect(await list()).toEqual([]);
    await waitFor(() => serverEvents().filter((event) => event.type === "agent.deleted").length === before + 2);
  });

  test("rejects invalid bodies and keeps cancel on DELETE /:id", async () => {
    for (const body of [{ ids: [], archived: true }, { ids: ["bld_x"], archived: true }, { all: false, archived: true }, { ids: ["run_abcdefghij"] }]) {
      expect((await t.json("POST", "/v1/agent/runs/archive", body)).status).toBe(400);
    }
    for (const body of [{ ids: [] }, { all: true, archived: "yes" }, {}]) {
      expect((await t.json("POST", "/v1/agent/runs/delete", body)).status).toBe(400);
    }
    expect((await t.json("POST", "/v1/agent/runs/archive", { ids: Array.from({ length: 501 }, () => "run_abcdefghij"), archived: true })).status).toBe(400);
    expect((await t.json("GET", "/v1/agent/runs?archived=maybe")).status).toBe(400);
    expect((await t.json("GET", "/v1/agent/runs/archive")).status).toBe(404);
    expect((await t.json("DELETE", "/v1/agent/runs/delete")).status).toBe(404);
  });
});
