import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LogLineListSchema, ProcessInfoSchema, ProcessLogStreamMessageSchema, type LogLine, type ProcessInfo } from "@theone/protocol";
import { LineSplitter } from "../src/core/line-splitter";
import { LogStore } from "../src/core/log-store";
import { silentLogger } from "../src/core/logger";
import { groupAlive, groupMembers } from "../src/core/process-group";
import { openDatabase } from "../src/db/database";
import { Repositories } from "../src/db/repositories";
import { labelledPid, makeTempDir, processGone, removeTempDirs, startTestController, waitFor, writeFiles, type TestController } from "./helpers";

let t: TestController;

async function start(body: Record<string, unknown>): Promise<ProcessInfo> {
  const { status, body: info } = await t.json("POST", "/v1/processes", { projectId: "app", ...body });
  if (status !== 201) throw new Error(`start failed: ${status} ${JSON.stringify(info)}`);
  return ProcessInfoSchema.parse(info);
}

async function finished(id: string): Promise<ProcessInfo> {
  return waitFor(async () => {
    const info = ProcessInfoSchema.parse((await t.json("GET", `/v1/processes/${id}`)).body);
    return info.endedAt ? info : null;
  }, 10_000);
}

async function logs(id: string, tail?: number): Promise<LogLine[]> {
  const { body } = await t.json("GET", `/v1/processes/${id}/logs${tail ? `?tail=${tail}` : ""}`);
  return LogLineListSchema.parse(body);
}

function freePort(): number {
  const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const port = listener.port;
  listener.stop(true);
  return port;
}

beforeAll(async () => {
  const workspace = makeTempDir("proc");
  writeFiles(workspace, { "projects/app/README.md": "app\n" });
  t = await startTestController({ workspace, controller: { stopGraceMs: 600 } });
});

afterAll(async () => {
  await t.stop();
  removeTempDirs();
});

describe("lifecycle", () => {
  test("runs a shell command in the project dir and captures stdout and stderr", async () => {
    const info = await start({ command: "pwd; echo out-line; echo err-line >&2", name: "hello" });
    expect(info).toMatchObject({ name: "hello", state: "running", projectId: "app" });
    expect(info.cwd.endsWith("/projects/app")).toBe(true);
    const done = await finished(info.id);
    expect(done).toMatchObject({ state: "exited", exitCode: 0 });
    const lines = await logs(info.id);
    expect(lines.find((line) => line.text === "out-line")?.stream).toBe("stdout");
    expect(lines.find((line) => line.text === "err-line")?.stream).toBe("stderr");
    expect(lines.some((line) => line.text.endsWith("/projects/app"))).toBe(true);
    expect(lines.at(-1)?.stream).toBe("system");
  });

  test("marks non-zero exits failed and runs argv commands directly", async () => {
    const failed = await finished((await start({ command: "exit 3" })).id);
    expect(failed).toMatchObject({ state: "failed", exitCode: 3 });
    const argv = await start({ command: ["printf", "%s|%s\\n", "a b", "$HOME"] });
    await finished(argv.id);
    expect((await logs(argv.id)).map((line) => line.text)).toContain("a b|$HOME");
  });

  test("records a failed spawn", async () => {
    const info = await start({ command: ["/definitely/not/here"] });
    expect(info.state).toBe("failed");
    expect((await logs(info.id)).some((line) => line.text.startsWith("Failed to start"))).toBe(true);
  });

  test("display and env are applied", async () => {
    const info = await start({ command: 'echo "D=$DISPLAY X=$EXTRA_VAR"', display: true, env: { EXTRA_VAR: "42" } });
    await finished(info.id);
    expect((await logs(info.id)).map((line) => line.text)).toContain("D=:987 X=42");
  });

  test("DELETE kills the whole process group", async () => {
    const info = await start({ command: "sleep 300 & sleep 300 & echo ready; wait" });
    await waitFor(async () => (await logs(info.id)).some((line) => line.text === "ready"));
    expect(groupAlive(info.pid ?? 0)).toBe(true);
    const { status, body } = await t.json("DELETE", `/v1/processes/${info.id}`);
    expect(status).toBe(200);
    expect(ProcessInfoSchema.parse(body).state).toBe("stopped");
    expect(groupAlive(info.pid ?? 0)).toBe(false);
  });

  test("escalates to SIGKILL when the group ignores SIGTERM", async () => {
    const info = await start({ command: "trap '' TERM; sleep 300 & echo ready; wait; wait" });
    await waitFor(async () => (await logs(info.id)).some((line) => line.text === "ready"));
    const started = Date.now();
    const stopped = ProcessInfoSchema.parse((await t.json("DELETE", `/v1/processes/${info.id}`)).body);
    expect(stopped.state).toBe("stopped");
    expect(Date.now() - started).toBeGreaterThanOrEqual(500);
    expect(groupAlive(info.pid ?? 0)).toBe(false);
  });

  test("stops what an exited command left running in its group and session", async () => {
    const info = await start({ command: "sleep 300 & echo same-group=$!; set -m; sleep 300 & echo own-group=$!; exit 0" });
    const done = await finished(info.id);
    expect(done).toMatchObject({ state: "exited", exitCode: 0 });
    const texts = (await logs(info.id)).map((line) => line.text);
    const output = texts.join("\n");
    for (const label of ["same-group", "own-group"]) expect(processGone(labelledPid(output, label))).toBe(true);
    expect(texts).toContainEqual(expect.stringMatching(/^Stopping 2 processes left running in the process group: sleep \(\d+\), sleep \(\d+\)$/));
    expect(texts.at(-1)).toBe("Process exited with code 0");
    expect(groupMembers(info.pid ?? 0)).toEqual([]);
    expect(groupAlive(info.pid ?? 0)).toBe(false);
  });

  test("SIGKILLs leftovers that ignore SIGTERM once the grace period is over", async () => {
    const info = await start({ command: "(trap '' TERM; exec sleep 300) & echo stubborn=$!; exit 0" });
    const done = await finished(info.id);
    expect(done).toMatchObject({ state: "exited", exitCode: 0 });
    expect(Date.parse(done.endedAt ?? "") - Date.parse(done.startedAt)).toBeGreaterThanOrEqual(600);
    const texts = (await logs(info.id)).map((line) => line.text);
    expect(processGone(labelledPid(texts.join("\n"), "stubborn"))).toBe(true);
    expect(texts).toContainEqual(expect.stringMatching(/^Stopping 1 process left running in the process group: sleep \(\d+\)$/));
  });

  test("lists processes per project", async () => {
    const { body } = await t.json<ProcessInfo[]>("GET", "/v1/processes?projectId=app");
    expect(body.length).toBeGreaterThan(3);
    expect((await t.json<ProcessInfo[]>("GET", "/v1/processes?projectId=other")).body).toEqual([]);
    expect((await t.json("POST", "/v1/processes", { projectId: "nope", command: "true" })).status).toBe(404);
  });
});

describe("ports", () => {
  test("409 when an untracked program holds the port", async () => {
    const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
    try {
      const { status, body } = await t.json<{ error: { code: string; message: string } }>("POST", "/v1/processes", {
        projectId: "app",
        command: "true",
        port: listener.port,
      });
      expect(status).toBe(409);
      expect(body.error.code).toBe("conflict");
      expect(body.error.message).toContain(String(listener.port));
    } finally {
      listener.stop(true);
    }
  });

  test("409 names the tracked process that owns the port", async () => {
    const declared = freePort();
    const server = `Bun.serve({ hostname: "127.0.0.1", port: Number(process.argv[1]), fetch: () => new Response("ok") }); console.log("listening")`;
    const owner = await start({ command: ["bun", "-e", server, String(declared)], port: declared, name: "web" });
    await waitFor(async () => (await logs(owner.id)).some((line) => line.text === "listening"));
    const clash = await t.json<{ error: { message: string } }>("POST", "/v1/processes", { projectId: "app", command: "true", port: declared });
    expect(clash.status).toBe(409);
    expect(clash.body.error.message).toContain(owner.id);

    const undeclared = freePort();
    const hidden = await start({ command: ["bun", "-e", server, String(undeclared)], name: "hidden" });
    await waitFor(async () => (await logs(hidden.id)).some((line) => line.text === "listening"));
    const found = await t.json<{ error: { message: string } }>("POST", "/v1/processes", { projectId: "app", command: "true", port: undeclared });
    expect(found.status).toBe(409);
    expect(found.body.error.message).toContain(hidden.id);

    await t.json("DELETE", `/v1/processes/${owner.id}`);
    await t.json("DELETE", `/v1/processes/${hidden.id}`);
    expect((await start({ command: "true", port: declared })).state).toBe("running");
  });
});

describe("log streaming", () => {
  test("replays history, follows live lines and ends with exit", async () => {
    const info = await start({ command: "for i in 1 2 3; do echo line-$i; sleep 0.2; done; exit 5" });
    await waitFor(async () => (await logs(info.id)).some((line) => line.text === "line-1"));
    const socket = await t.socket(`/v1/processes/${info.id}/logs/stream`);
    const exit = await socket.waitFor<{ type: string; code?: number | null }>((message) => message.type === "exit", 8_000);
    expect(exit).toEqual({ type: "exit", code: 5 });
    const parsed = socket.messages.map((message) => ProcessLogStreamMessageSchema.parse(message));
    const texts = parsed.flatMap((message) => (message.type === "log" ? [message.line.text] : []));
    expect(texts.filter((text) => text.startsWith("line-"))).toEqual(["line-1", "line-2", "line-3"]);
    const seqs = parsed.flatMap((message) => (message.type === "log" ? [message.line.seq] : []));
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
    expect((await socket.closed).code).toBe(1000);
  });

  test("streams a finished process from disk and closes", async () => {
    const info = await start({ command: "echo done-already" });
    await finished(info.id);
    const socket = await t.socket(`/v1/processes/${info.id}/logs/stream`);
    await socket.waitFor((message: { type: string }) => message.type === "exit");
    expect(socket.messages.some((message) => (message as { line?: LogLine }).line?.text === "done-already")).toBe(true);
  });
});

describe("log store", () => {
  test("rotates files and tails across the rotation after eviction", () => {
    const dir = makeTempDir("logs");
    const store = new LogStore(dir, silentLogger, { rotateBytes: 2_000, ringLines: 10 });
    const channel = store.open("prc_rotation");
    for (let i = 1; i <= 200; i += 1) {
      channel.append("stdout", `line ${i}`);
      if (i % 20 === 0) channel.flush();
    }
    channel.end(0);
    expect(existsSync(join(dir, "prc_rotation.log.1"))).toBe(true);
    expect(readFileSync(join(dir, "prc_rotation.log"), "utf8").length).toBeLessThanOrEqual(2_000);
    expect(channel.tail(3).map((line) => line.text)).toEqual(["line 198", "line 199", "line 200"]);
    const fresh = new LogStore(dir, silentLogger);
    const tail = fresh.tail("prc_rotation", 30);
    expect(tail.at(-1)).toMatchObject({ seq: 200, text: "line 200", stream: "stdout" });
    expect(tail.length).toBe(30);
  });

  test("line splitter handles partial chunks, CRLF and progress bars", () => {
    const splitter = new LineSplitter();
    expect(splitter.push("par")).toEqual([]);
    expect(splitter.push(new TextEncoder().encode("tial\r\nnext 10%\rnext 100%\nta"))).toEqual(["partial", "next 100%"]);
    expect(splitter.flush()).toEqual(["ta"]);
    const utf8 = new TextEncoder().encode("é\n");
    const multi = new LineSplitter();
    expect(multi.push(utf8.subarray(0, 1))).toEqual([]);
    expect(multi.push(utf8.subarray(1))).toEqual(["é"]);
  });
});

test("restart marks live rows orphaned and never re-runs them", async () => {
  const workspace = makeTempDir("restart");
  writeFiles(workspace, { "projects/app/.keep": "" });
  const first = await startTestController({ workspace });
  const dbPath = first.config.dbPath;
  await first.stop();
  const db = openDatabase(dbPath);
  const repos = new Repositories(db);
  repos.processes.save({
    id: "prc_leftover01",
    projectId: "app",
    name: "old",
    command: "sleep 1000",
    cwd: workspace,
    pid: 999_999,
    port: null,
    display: false,
    state: "running",
    exitCode: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
  });
  db.close();
  const second = await startTestController({ workspace });
  try {
    const info = ProcessInfoSchema.parse((await second.json("GET", "/v1/processes/prc_leftover01")).body);
    expect(info.state).toBe("orphaned");
    expect(info.endedAt).not.toBeNull();
  } finally {
    await second.stop();
  }
});
