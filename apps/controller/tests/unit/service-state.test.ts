import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentRun, BuildJob, DisplayStatus, ProcessInfo, TerminalInfo } from "@theone/protocol";
import { loadConfig, ensureDirectories, type Config } from "../../src/config";
import { EventHub } from "../../src/core/events";
import { createLogger, silentLogger, type LogLevel } from "../../src/core/logger";
import { openDatabase, SCHEMA_VERSION } from "../../src/db/database";
import { Repositories } from "../../src/db/repositories";
import { ArtifactService } from "../../src/services/artifacts";
import { readAgentContext } from "../../src/services/context";
import { DisplayService } from "../../src/services/display";
import { InboxService } from "../../src/services/inbox";
import { renderRuntime, RuntimeMirror, type RuntimeSnapshot } from "../../src/services/runtime-mirror";
import { readResources, StatusService } from "../../src/services/status";
import { ToolService } from "../../src/services/tools";
import { makeTempDir, removeTempDirs, waitFor } from "../helpers";

afterEach(removeTempDirs);

const TS = "2024-01-01T00:00:00.000Z";

function workspaceConfig(env: Record<string, string> = {}): Config {
  const config = loadConfig({ THEONE_WORKSPACE: makeTempDir("state"), THEONE_VNC_PORT: "1", THEONE_DISPLAY: ":987", ...env });
  ensureDirectories(config);
  return config;
}

function processInfo(overrides: Partial<ProcessInfo> = {}): ProcessInfo {
  return {
    id: "p1",
    projectId: "app",
    name: "dev",
    command: ["npm", "run", "dev"],
    cwd: "/w",
    pid: 10,
    port: 3000,
    display: false,
    state: "running",
    exitCode: null,
    startedAt: TS,
    endedAt: null,
    ...overrides,
  };
}

function display(overrides: Partial<DisplayStatus> = {}): DisplayStatus {
  return {
    display: ":1",
    available: true,
    width: 1024,
    height: 768,
    vnc: { available: true, port: 5901, password: null },
    webPath: "/ui/vnc",
    ...overrides,
  };
}

function build(overrides: Partial<BuildJob> = {}): BuildJob {
  return {
    id: "b1",
    projectId: "app",
    target: "web",
    profile: "debug",
    state: "succeeded",
    stage: null,
    progress: 1,
    startedAt: TS,
    endedAt: TS,
    createdAt: TS,
    error: null,
    artifacts: [],
    ...overrides,
  };
}

function agentRun(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    id: "r1",
    projectId: null,
    prompt: "p",
    mode: null,
    attachments: [],
    sessionId: null,
    state: "running",
    startedAt: TS,
    endedAt: null,
    usage: null,
    result: null,
    error: null,
    archivedAt: null,
    ...overrides,
  };
}

describe("database and repositories", () => {
  test("migrations are applied once and survive reopening", () => {
    const path = join(makeTempDir("db"), "state.db");
    const first = openDatabase(path);
    expect(first.query<{ user_version: number }, []>("PRAGMA user_version").get()?.user_version).toBe(SCHEMA_VERSION);
    new Repositories(first).processes.save(processInfo());
    first.close();
    const second = openDatabase(path);
    expect(new Repositories(second).processes.get("p1")?.command).toEqual(["npm", "run", "dev"]);
    second.close();
  });

  test("agent runs keep mode and attachments; rows from before migration 4 read as null and []", () => {
    const db = openDatabase(":memory:");
    const repos = new Repositories(db);
    db.query("INSERT INTO agent_runs (id, project_id, prompt, session_id, state, started_at) VALUES ('run_old', NULL, 'p', NULL, 'succeeded', ?)").run(TS);
    expect(repos.agentRuns.get("run_old")).toMatchObject({ mode: null, attachments: [], usage: null });
    const upload = { id: "upl_a", name: "a.png", mimeType: "image/png", kind: "image" as const, sizeBytes: 3, path: "/w/.theone/uploads/upl_a/a.png", createdAt: TS };
    repos.uploads.save(upload);
    expect(repos.uploads.get("upl_a")).toEqual(upload);
    repos.agentRuns.save(agentRun({ id: "run_new", mode: "plan", attachments: [upload] }));
    expect(repos.agentRuns.get("run_new")).toMatchObject({ mode: "plan", attachments: [upload] });
    expect(repos.deleteUploadsBefore("2025-01-01T00:00:00.000Z")).toEqual([upload]);
    expect(repos.uploads.get("upl_a")).toBeNull();
  });

  test("the token-usage migration drops cost_usd and keeps existing agent runs", () => {
    const path = join(makeTempDir("db"), "state.db");
    const legacy = new Database(path);
    legacy.run(`CREATE TABLE agent_runs (id TEXT PRIMARY KEY, project_id TEXT, prompt TEXT NOT NULL, session_id TEXT, state TEXT NOT NULL,
      started_at TEXT NOT NULL, ended_at TEXT, cost_usd REAL, result TEXT, error TEXT, archived_at TEXT, mode TEXT, attachments TEXT)`);
    legacy.query("INSERT INTO agent_runs (id, prompt, state, started_at, cost_usd) VALUES ('run_old', 'p', 'succeeded', ?, 0.5)").run(TS);
    legacy.run("PRAGMA user_version = 6");
    legacy.close();
    const db = openDatabase(path);
    const columns = db.query<{ name: string }, []>("PRAGMA table_info(agent_runs)").all().map((column) => column.name);
    expect(columns).not.toContain("cost_usd");
    expect(columns).toEqual(expect.arrayContaining(["input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens"]));
    expect(new Repositories(db).agentRuns.get("run_old")).toMatchObject({ state: "succeeded", usage: null });
    db.close();
  });

  test("round-trips every entity, upserts, filters, limits and orders newest first", () => {
    const db = openDatabase(":memory:");
    const repos = new Repositories(db);
    repos.processes.save(processInfo({ id: "p1", command: "echo hi", display: true, startedAt: "2024-01-01T00:00:01.000Z" }));
    repos.processes.save(processInfo({ id: "p2", projectId: null, startedAt: "2024-01-01T00:00:02.000Z" }));
    repos.processes.save(processInfo({ id: "p1", command: "echo hi", display: true, state: "exited", exitCode: 0, startedAt: "2024-01-01T00:00:01.000Z" }));
    expect(repos.processes.get("p1")).toMatchObject({ command: "echo hi", display: true, state: "exited", exitCode: 0 });
    expect(repos.processes.list().map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(repos.processes.list({ projectId: "app" }).map((p) => p.id)).toEqual(["p1"]);
    expect(repos.processes.list({ limit: 1 }).map((p) => p.id)).toEqual(["p2"]);
    expect(repos.processes.get("missing")).toBeNull();

    const terminal: TerminalInfo = { id: "t1", kind: "shell", projectId: null, title: "Shell", cwd: "/w", pid: 1, cols: 80, rows: 24, state: "running", exitCode: null, createdAt: TS };
    repos.terminals.save(terminal);
    expect(repos.terminals.get("t1")).toEqual(terminal);

    const { artifacts: _artifacts, ...record } = build({ progress: 0.5, stage: "compile", error: "e" });
    repos.builds.save(record);
    expect(repos.builds.get("b1")).toEqual(record);

    const artifact = { id: "a1", projectId: "app", buildId: "b1", fileName: "f.zip", path: "/a/f.zip", sizeBytes: 3, sha256: "x", platform: "web", source: "build" as const, agentRunId: null, note: null, createdAt: TS };
    repos.artifacts.save(artifact);
    repos.artifacts.save({ ...artifact, id: "a2", createdAt: "2024-01-01T00:00:05.000Z" });
    expect(repos.artifactsForBuild("b1").map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(repos.artifactsForBuild("other")).toEqual([]);

    repos.agentRuns.save(agentRun({ usage: { inputTokens: 12, outputTokens: 340, cacheReadTokens: 5600, cacheWriteTokens: 78, totalTokens: 6030 }, result: "ok" }));
    expect(repos.agentRuns.get("r1")).toMatchObject({ usage: { inputTokens: 12, outputTokens: 340, cacheReadTokens: 5600, cacheWriteTokens: 78, totalTokens: 6030 }, result: "ok" });
    repos.appendAgentEvent("r1", { kind: "text", text: "b", seq: 2, ts: TS });
    repos.appendAgentEvent("r1", { kind: "text", text: "a", seq: 1, ts: TS });
    repos.appendAgentEvent("r1", { kind: "text", text: "a2", seq: 1, ts: TS });
    expect(repos.agentEvents("r1").map((e) => (e.kind === "text" ? e.text : ""))).toEqual(["a2", "b"]);
    db.close();
  });

  test("recoverAfterRestart ends live rows and keeps existing errors", () => {
    const db = openDatabase(":memory:");
    const repos = new Repositories(db);
    repos.processes.save(processInfo({ id: "live", state: "starting" }));
    repos.processes.save(processInfo({ id: "done", state: "exited", endedAt: TS }));
    repos.terminals.save({ id: "t", kind: "shell", projectId: null, title: "S", cwd: "/", pid: 1, cols: 1, rows: 1, state: "running", exitCode: null, createdAt: TS });
    const { artifacts: _a, ...queued } = build({ id: "q", state: "queued", error: "earlier" });
    const { artifacts: _b, ...running } = build({ id: "r", state: "running" });
    repos.builds.save(queued);
    repos.builds.save(running);
    repos.agentRuns.save(agentRun());
    expect(repos.recoverAfterRestart("2025-01-01T00:00:00.000Z")).toEqual({ processes: 1, terminals: 1, builds: 2, agentRuns: 1 });
    expect(repos.processes.get("live")).toMatchObject({ state: "orphaned", endedAt: "2025-01-01T00:00:00.000Z" });
    expect(repos.processes.get("done")?.endedAt).toBe(TS);
    expect(repos.builds.get("q")?.error).toBe("earlier");
    expect(repos.builds.get("r")?.error).toBe("The controller restarted before this finished");
    expect(repos.agentRuns.get("r1")?.state).toBe("failed");
    expect(repos.recoverAfterRestart(TS)).toEqual({ processes: 0, terminals: 0, builds: 0, agentRuns: 0 });
    db.close();
  });
});

describe("ArtifactService", () => {
  function setup() {
    const config = workspaceConfig();
    const db = openDatabase(":memory:");
    const repos = new Repositories(db);
    const hub = new EventHub(silentLogger);
    const events: string[] = [];
    hub.subscribe((event) => events.push(event.type));
    const inbox = new InboxService(repos, hub, silentLogger);
    return { config, repos, events, inbox, service: new ArtifactService(config, repos, hub, inbox, silentLogger), db };
  }
  const meta = { projectId: "app", buildId: "b1", platform: "web", profile: "debug" as const, version: "1.0" };

  test("copies by default, moves on request, and never overwrites", async () => {
    const { config, service, events, db } = setup();
    const source = join(makeTempDir("src"), "out.tar.gz");
    writeFileSync(source, "payload");
    const first = await service.store(source, meta);
    expect(first).toMatchObject({ fileName: "app-web-debug-1.0.tar.gz", sizeBytes: 7, buildId: "b1", platform: "web" });
    expect(existsSync(source)).toBe(true);
    writeFileSync(join(config.artifactsDir, "app-web-debug-1.0-2.tar.gz"), "squatter");
    const moved = await service.store(source, meta, { move: true });
    expect(moved.fileName).toBe("app-web-debug-1.0-3.tar.gz");
    expect(existsSync(source)).toBe(false);
    expect(readFileSync(join(config.artifactsDir, "app-web-debug-1.0-2.tar.gz"), "utf8")).toBe("squatter");
    expect(events).toEqual(["artifact.created", "artifact.created"]);
    expect(service.forBuild("b1").map((a) => a.id)).toEqual([first.id, moved.id]);
    expect(service.list("app")).toHaveLength(2);
    expect(service.list("other")).toEqual([]);
    expect(service.get(first.id).sha256).toBe(first.sha256);
    expect(() => service.get("artifact_missing")).toThrow(/not found/);
    db.close();
  });

  test("a missing source is an error, not a row", async () => {
    const { service, db } = setup();
    await expect(service.store(join(makeTempDir("src"), "missing.zip"), meta)).rejects.toThrow();
    expect(service.list()).toEqual([]);
    db.close();
  });

  test("download refuses removed files and paths that escape the artifacts dir", async () => {
    const { config, service, repos, db } = setup();
    const source = join(makeTempDir("src"), "a.zip");
    writeFileSync(source, "zip");
    const stored = await service.store(source, meta);
    expect(service.download(stored.id).path).toBe(stored.path);

    const outside = join(makeTempDir("outside"), "secret.zip");
    writeFileSync(outside, "secret");
    repos.artifacts.save({ ...stored, id: "artifact_escape", path: outside });
    expect(() => service.download("artifact_escape")).toThrow(/no longer available/);

    const link = join(config.artifactsDir, "link.zip");
    symlinkSync(outside, link);
    repos.artifacts.save({ ...stored, id: "artifact_link", path: link });
    expect(() => service.download("artifact_link")).toThrow(/no longer available/);

    mkdirSync(join(config.artifactsDir, "dir.zip"));
    repos.artifacts.save({ ...stored, id: "artifact_dir", path: join(config.artifactsDir, "dir.zip") });
    expect(() => service.download("artifact_dir")).toThrow(/no longer available/);

    rmSync(stored.path);
    expect(() => service.download(stored.id)).toThrow(/no longer available/);
    db.close();
  });
});

describe("readAgentContext", () => {
  test("reads top-level and per-project markdown, sorted, skipping everything else", () => {
    const agentDir = makeTempDir("ctx");
    writeFileSync(join(agentDir, "b.md"), "B");
    writeFileSync(join(agentDir, "A.MD"), "A");
    writeFileSync(join(agentDir, "notes.txt"), "no");
    mkdirSync(join(agentDir, "dir.md"));
    mkdirSync(join(agentDir, "projects", "app"), { recursive: true });
    writeFileSync(join(agentDir, "projects", "app", "PLAN.md"), "0123456789");
    writeFileSync(join(agentDir, "projects", "stray.md"), "not in a project");
    const past = new Date("2024-02-03T04:05:06.000Z");
    utimesSync(join(agentDir, "b.md"), past, past);

    const { files } = readAgentContext(agentDir, 4);
    expect(files.map((file) => file.name)).toEqual(["A.MD", "b.md", "projects/app/PLAN.md"]);
    expect(files[1]).toMatchObject({ content: "B", sizeBytes: 1, truncated: false, modifiedAt: past.toISOString(), path: join(agentDir, "b.md") });
    expect(files[2]).toMatchObject({ content: "0123", sizeBytes: 10, truncated: true });
  });

  test("a missing directory yields no files", () => {
    expect(readAgentContext(join(makeTempDir("ctx"), "missing"))).toEqual({ files: [] });
  });
});

describe("renderRuntime", () => {
  const snapshot = (overrides: Partial<RuntimeSnapshot> = {}): RuntimeSnapshot => ({
    generatedAt: TS,
    version: "1.0.0",
    sandboxId: "box",
    apiUrl: "http://127.0.0.1:8787",
    display: display(),
    running: [],
    ended: [],
    terminals: [],
    activeBuilds: [],
    recentBuilds: [],
    runs: [],
    ...overrides,
  });

  test("empty sections say so", () => {
    const text = renderRuntime(snapshot({ display: display({ available: false, width: null, height: null, vnc: { available: false, port: 5901, password: "pw" } }) }));
    expect(text).toContain("- X display :1: not available");
    expect(text).toContain("- VNC port 5901: not available · web viewer /ui/vnc");
    expect(text.match(/_None\._/g)).toHaveLength(6);
    expect(text).not.toContain("pw");
  });

  test("tables escape pipes, flatten whitespace and show placeholders", () => {
    const text = renderRuntime(
      snapshot({
        running: [processInfo({ name: "a|b\nc", port: null, display: true })],
        ended: [processInfo({ id: "p9", state: "failed", exitCode: 2, endedAt: TS })],
        terminals: [
          { id: "t1", kind: "shell", projectId: null, title: "S", cwd: "/", pid: 5, cols: 80, rows: 24, state: "running", exitCode: null, createdAt: TS },
          { id: "t2", kind: "claude", projectId: "app", title: "C", cwd: "/", pid: 6, cols: 80, rows: 24, state: "exited", exitCode: 0, createdAt: TS },
        ],
        activeBuilds: [build({ state: "running", stage: "compile" })],
        recentBuilds: [
          build({ id: "ok", artifacts: [{ id: "a", projectId: "app", buildId: "ok", fileName: "x.zip", path: "/x", sizeBytes: 1, sha256: "s", platform: "web", source: "build", agentRunId: null, note: null, createdAt: TS }] }),
          build({ id: "logs" }),
          build({ id: "bad", state: "failed", error: "boom" }),
        ],
        runs: [agentRun({ sessionId: "sess" })],
      }),
    );
    expect(text).toContain("- X display :1: available (1024x768)");
    expect(text).toContain("## Running processes (1)");
    expect(text).toContain("| p1 | app | a\\|b c | 10 | – | yes | 2024-01-01T00:00:00.000Z | npm run dev |");
    expect(text).toContain("## Terminals (1 running)");
    expect(text).toContain("| t1 | shell | – | 5 | 80x24 | running |");
    expect(text).toContain("| ok | app | web | succeeded | 2024-01-01T00:00:00.000Z | x.zip |");
    expect(text).toContain("| logs | app | web | succeeded | 2024-01-01T00:00:00.000Z | logs only |");
    expect(text).toContain("| bad | app | web | failed | 2024-01-01T00:00:00.000Z | boom |");
    expect(text).toContain("| r1 | – | running | sess |");
    expect(text).toContain("| p9 | app | dev | failed | 2 |");
  });
});

describe("RuntimeMirror", () => {
  function mirror(config: Config, displayStatus: () => Promise<DisplayStatus>, logger = silentLogger, pollMs = 30_000) {
    const db = openDatabase(":memory:");
    const repos = new Repositories(db);
    const { artifacts: _a, ...finished } = build({ id: "done" });
    repos.builds.save(finished);
    repos.agentRuns.save(agentRun({ id: "old", state: "succeeded" }));
    const deps = {
      version: "9.9.9",
      apiUrl: "http://api",
      repos,
      processes: { running: () => [processInfo()] },
      terminals: { list: () => [] },
      builds: { activeBuilds: () => [], get: (id: string) => build({ id }) },
      agentRuns: { running: () => [agentRun({ id: "live" })] },
      display: { status: displayStatus },
    };
    return { db, mirror: new RuntimeMirror(config, deps as never, logger, 10, pollMs) };
  }

  test("writes on start, rewrites on watched events only, and flushes on stop", async () => {
    const config = workspaceConfig();
    const hub = new EventHub(silentLogger);
    const { mirror: runtime, db } = mirror(config, async () => display());
    expect(runtime.path).toBe(join(config.agentDir, "RUNTIME.md"));
    runtime.start(hub);
    await runtime.flush();
    const first = readFileSync(runtime.path, "utf8");
    expect(first).toContain("controller 9.9.9");
    expect(first).toContain("| live |");
    expect(first).toContain("| old |");
    expect(first).toContain("| done |");
    expect(statSync(runtime.path).mode & 0o777).toBe(0o644);

    rmSync(runtime.path);
    hub.publish({ type: "status", event: { project: null, status: "x", message: "m", ts: TS } });
    await Bun.sleep(40);
    expect(existsSync(runtime.path)).toBe(false);
    hub.publish({ type: "process.updated", process: processInfo() });
    hub.publish({ type: "process.updated", process: processInfo() });
    await runtime.stop();
    expect(existsSync(runtime.path)).toBe(true);
    hub.publish({ type: "process.updated", process: processInfo() });
    await runtime.flush();
    db.close();
  });

  test("a write failure is logged and later writes still happen", async () => {
    const config = workspaceConfig();
    const lines: { line: string; level: LogLevel }[] = [];
    const logger = createLogger("debug", "rt", (line, level) => lines.push({ line, level }));
    let fail = true;
    const { mirror: runtime, db } = mirror(config, async () => {
      if (fail) throw new Error("display probe exploded");
      return display();
    }, logger);
    runtime.schedule();
    await runtime.flush();
    expect(lines.some((entry) => entry.level === "warn" && entry.line.includes("display probe exploded"))).toBe(true);
    fail = false;
    runtime.schedule();
    await runtime.flush();
    expect(existsSync(runtime.path)).toBe(true);
    db.close();
  });

  test("polls the display and rewrites only when it changes, surviving probe failures", async () => {
    const config = workspaceConfig();
    const lines: { line: string; level: LogLevel }[] = [];
    const logger = createLogger("debug", "rt", (line, level) => lines.push({ line, level }));
    let current: DisplayStatus | Error = display();
    let probes = 0;
    const { mirror: runtime, db } = mirror(
      config,
      async () => {
        probes += 1;
        if (current instanceof Error) throw current;
        return current;
      },
      logger,
      15,
    );
    runtime.start(new EventHub(silentLogger));
    await runtime.flush();
    rmSync(runtime.path);
    await waitFor(() => probes >= 4);
    expect(existsSync(runtime.path)).toBe(false);
    current = display({ width: 800, height: 600 });
    await waitFor(() => existsSync(runtime.path));
    expect(readFileSync(runtime.path, "utf8")).toContain("available (800x600)");
    current = new Error("xdpyinfo crashed");
    const before = probes;
    await waitFor(() => probes >= before + 3);
    await runtime.stop();
    expect(lines.some((entry) => entry.line.includes("xdpyinfo crashed"))).toBe(true);
    db.close();
  });
});

describe("DisplayService", () => {
  test("caches status for the cache window and reports the configured VNC target", async () => {
    let connections = 0;
    const rfb = Bun.listen({
      hostname: "127.0.0.1",
      port: 0,
      socket: {
        open(socket) {
          connections += 1;
          socket.write("RFB 003.008\n");
        },
        data() {},
      },
    });
    try {
      const config = workspaceConfig({ THEONE_VNC_PORT: String(rfb.port), THEONE_VNC_PASSWORD: "pw" });
      const service = new DisplayService(config, 60_000);
      const first = await service.status();
      expect(first).toMatchObject({ display: ":987", available: false, width: null, vnc: { available: true, port: rfb.port, password: "pw" }, webPath: "/ui/vnc" });
      expect(await service.status()).toBe(first);
      expect(connections).toBe(1);
      const uncached = new DisplayService(config, 0);
      await uncached.status();
      await uncached.status();
      expect(connections).toBe(3);
      await expect(service.screenshot()).rejects.toThrow("Display :987 is not available");
    } finally {
      rfb.stop(true);
    }
  });

  test("a display name without a local socket is probed with xdpyinfo", async () => {
    const config = workspaceConfig({ THEONE_DISPLAY: "nonexistent-host.invalid:5" });
    const status = await new DisplayService(config).status();
    expect(status.available).toBe(false);
    expect(status.vnc.available).toBe(false);
  });
});

describe("status", () => {
  test("readResources reports sane numbers and tolerates a missing disk path", () => {
    const resources = readResources("/");
    expect(resources.cpu.cores).toBeGreaterThan(0);
    expect(resources.memory.totalBytes).toBeGreaterThan(0);
    expect(resources.memory.usedBytes).toBeGreaterThanOrEqual(0);
    expect(resources.memory.usedBytes).toBeLessThanOrEqual(resources.memory.totalBytes);
    expect(resources.disk.totalBytes).toBeGreaterThan(0);
    expect([resources.cpu.load1, resources.cpu.load5, resources.cpu.load15].every(Number.isFinite)).toBe(true);
    expect(readResources("/nonexistent/path/for/statfs").disk).toEqual({ path: "/nonexistent/path/for/statfs", totalBytes: 0, usedBytes: 0 });
  });

  test("StatusService combines config, display, tools and counts", async () => {
    const config = workspaceConfig({ THEONE_SANDBOX_ID: "box" });
    const counts = { projects: 1, runningProcesses: 2, activeBuilds: 3, terminals: 4, agentRuns: 5 };
    const service = new StatusService(config, "1.2.3", new ToolService([]), { status: async () => display() } as never, () => counts);
    const status = await service.status();
    expect(status).toMatchObject({ sandboxId: "box", version: "1.2.3", tools: [], counts, display: display() });
    expect(status.uptimeSec).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(Date.parse(status.startedAt))).toBe(false);
    expect(status.resources.disk.path).toBe(config.workspace);
  });
});
