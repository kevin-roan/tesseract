import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { AgentRunSchema, ProcessInfoSchema, TerminalInfoSchema } from "@tesseract/protocol";
import { openDatabase } from "../src/db/database";
import { Repositories } from "../src/db/repositories";
import { installFakeClaude, makeTempDir, processGone, removeTempDirs, startTestController, TEST_TOKEN, waitFor, writeFiles } from "./helpers";

const ENTRY = join(import.meta.dir, "..", "src", "index.ts");

afterEach(removeTempDirs);

describe("controller shutdown", () => {
  test("stop() ends live processes, agent runs and terminals and records their final state", async () => {
    const workspace = makeTempDir("shutdown");
    writeFiles(workspace, { "projects/app/.keep": "" });
    const claude = installFakeClaude(makeTempDir("bin"));
    const t = await startTestController({ workspace, env: { TESSERACT_CLAUDE_BIN: claude } });

    const proc = ProcessInfoSchema.parse((await t.json("POST", "/v1/processes", { projectId: "app", command: "sleep 60" })).body);
    const run = AgentRunSchema.parse((await t.json("POST", "/v1/agent/runs", { prompt: "slow please" })).body);
    const terminal = TerminalInfoSchema.parse((await t.json("POST", "/v1/terminals", { kind: "shell", cols: 80, rows: 24 })).body);
    await waitFor(async () => (await t.json<{ events: unknown[] }>("GET", `/v1/agent/runs/${run.id}`)).body.events.length >= 2);

    const first = t.stop();
    expect(t.stop()).toBe(first);
    await first;

    for (const pid of [proc.pid, terminal.pid]) expect(processGone(pid ?? 0)).toBe(true);
    const db = openDatabase(t.config.dbPath);
    try {
      const repos = new Repositories(db);
      expect(repos.processes.get(proc.id)?.state).toBe("stopped");
      expect(repos.agentRuns.get(run.id)).toMatchObject({ state: "cancelled", error: "Cancelled" });
      expect(repos.terminals.get(terminal.id)?.state).toBe("exited");
    } finally {
      db.close();
    }
  }, 20_000);
});

describe("serve", () => {
  test("the entrypoint serves until SIGTERM, then shuts down cleanly with exit code 0", async () => {
    const probe = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
    const port = probe.port;
    probe.stop(true);
    const proc = Bun.spawn(["bun", ENTRY, "serve"], {
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        TESSERACT_WORKSPACE: makeTempDir("serve"),
        TESSERACT_HOST: "127.0.0.1",
        TESSERACT_PORT: String(port),
        TESSERACT_TOKEN: TEST_TOKEN,
        TESSERACT_VNC_PORT: "1",
        TESSERACT_DISPLAY: ":987",
        TESSERACT_CLAUDE_BIN: "/nonexistent/claude",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    try {
      await waitFor(async () => (await fetch(`http://127.0.0.1:${port}/v1/health`)).ok, 15_000);
      proc.kill("SIGTERM");
      const [stdout, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
      expect(code).toBe(0);
      expect(stdout).toContain("controller listening");
      expect(stdout).toContain("shutting down signal=SIGTERM");
    } finally {
      proc.kill("SIGKILL");
    }
  }, 30_000);
});
