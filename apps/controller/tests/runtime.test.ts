import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Socket, TCPSocketListener } from "bun";
import {
  AppRunSchema,
  LogLineListSchema,
  ProcessInfoSchema,
  restPaths,
  RuntimeEntrySchema,
  RuntimeListSchema,
  TerminalInfoSchema,
  type RuntimeEntry,
} from "@tesseract/protocol";
import type { ProcSample } from "../src/core/proc";
import { parseSupervisorStatus, procfsSource, type ProcSource, type SupervisorProgram } from "../src/services/sandbox-runtime";
import { installFakeClaude, makeTempDir, processGone, removeTempDirs, startTestController, waitFor, writeFiles, type TestController } from "./helpers";

const FOREIGN = /^(chromium|chromium-browse|chrome|Xvnc|supervisord)$/;
const STUBBORN = "trap '' TERM; while true; do sleep 0.1; done";
const WEB_SERVER = "process.on('SIGTERM', () => {});\nBun.serve({ port: Number(process.env.PORT), hostname: process.env.HOST, fetch: () => new Response('ok') });\n";

type Fake = { sample: ProcSample; argv: string[] };

/** Real /proc for the controller's own children, fake Chromium / supervisord / Xvnc processes the test controls. */
class FakeProcs implements ProcSource {
  readonly fakes = new Map<number, Fake>();
  readonly signals: [number, string][] = [];
  dieOn = new Set<string>(["SIGKILL", "SIGTERM"]);

  add(pid: number, command: string, ppid: number, argv: string[]): void {
    this.fakes.set(pid, {
      sample: { pid, command, state: "S", ppid, pgrp: pid, session: pid, cpuTicks: 50, startTicks: 100, rssPages: 256 },
      argv,
    });
  }

  samples(): ProcSample[] | null {
    const real = (procfsSource.samples() ?? []).filter((sample) => !FOREIGN.test(sample.command) && !this.fakes.has(sample.pid));
    return [...real, ...[...this.fakes.values()].map((fake) => fake.sample)];
  }

  sample(pid: number): ProcSample | null {
    return this.fakes.get(pid)?.sample ?? null;
  }

  cmdline(pid: number): string[] | null {
    return this.fakes.get(pid)?.argv ?? procfsSource.cmdline(pid);
  }

  uptimeSeconds(): number | null {
    return procfsSource.uptimeSeconds();
  }

  kill = (pid: number, signal: NodeJS.Signals): boolean => {
    this.signals.push([pid, signal]);
    if (!this.fakes.has(pid)) return false;
    if (this.dieOn.has(signal)) this.fakes.delete(pid);
    return true;
  };
}

const procs = new FakeProcs();
const supervisorCalls: string[] = [];
let xvncStatus: SupervisorProgram | null = null;
const cdpCalls: number[] = [];
let cdpWorks = true;

let t: TestController;
let rfb: TCPSocketListener<undefined>;
const rfbSockets = new Set<Socket<undefined>>();

async function entries(): Promise<RuntimeEntry[]> {
  const { status, body } = await t.json("GET", restPaths.runtime());
  expect(status).toBe(200);
  return RuntimeListSchema.parse(body).entries;
}

async function stop(kind: RuntimeEntry["kind"], id: string, signal?: "SIGTERM" | "SIGKILL"): Promise<{ status: number; entry: RuntimeEntry | null }> {
  const { status, body } = await t.json("DELETE", restPaths.runtimeEntry(kind, id, signal ? { signal } : undefined));
  return { status, entry: status === 200 ? RuntimeEntrySchema.parse(body) : null };
}

async function startProcess(command: string, name: string) {
  const { status, body } = await t.json("POST", "/v1/processes", { projectId: "app", command, name });
  if (status !== 201) throw new Error(`start failed: ${status} ${JSON.stringify(body)}`);
  const info = ProcessInfoSchema.parse(body);
  await Bun.sleep(150);
  return info;
}

beforeAll(async () => {
  rfb = Bun.listen({
    hostname: "127.0.0.1",
    port: 0,
    socket: {
      open(socket) {
        rfbSockets.add(socket);
        socket.write("RFB 003.008\n");
      },
      data() {},
      close(socket) {
        rfbSockets.delete(socket);
      },
    },
  });
  const workspace = makeTempDir("runtime");
  writeFiles(workspace, {
    "projects/app/README.md": "app\n",
    "projects/web/package.json": JSON.stringify({ name: "web", scripts: { dev: "bun server.js" } }),
    "projects/web/bun.lock": "{}",
    "projects/web/server.js": WEB_SERVER,
  });
  t = await startTestController({
    workspace,
    env: { TESSERACT_VNC_PORT: String(rfb.port), TESSERACT_CLAUDE_BIN: installFakeClaude(makeTempDir("bin")) },
    controller: {
      stopGraceMs: 5_000,
      appRuns: { readyPollMs: 50 },
      sandboxRuntime: {
        proc: procs,
        kill: procs.kill,
        stopGraceMs: 300,
        killWaitMs: 300,
        pollMs: 10,
        supervisor: {
          status: async (program) => {
            supervisorCalls.push(`status ${program}`);
            return xvncStatus;
          },
          stop: async (program) => {
            supervisorCalls.push(`stop ${program}`);
            procs.fakes.delete(990_101);
            return true;
          },
        },
        closeBrowser: async (port) => {
          cdpCalls.push(port);
          if (cdpWorks) procs.fakes.delete(990_001);
          return cdpWorks;
        },
      },
    },
  });
});

afterAll(async () => {
  await t.stop();
  rfb.stop(true);
  removeTempDirs();
});

describe("managed work", () => {
  test("lists a running process with usage and kills its group at once", async () => {
    const info = await startProcess(STUBBORN, "stubborn");
    const listed = (await entries()).find((entry) => entry.kind === "process" && entry.id === info.id);
    expect(listed).toMatchObject({ name: "stubborn", projectId: "app", pid: info.pid, state: "running", supervised: false, canStop: true });
    expect(listed?.memoryBytes).toBeGreaterThan(0);
    expect(listed?.cpuPercent).not.toBeNull();

    const started = Date.now();
    const { status, entry } = await stop("process", info.id, "SIGKILL");
    expect(status).toBe(200);
    expect(Date.now() - started).toBeLessThan(2_500);
    expect(entry).toMatchObject({ kind: "process", id: info.id, state: "killed", canStop: false, cpuPercent: null });
    expect(processGone(info.pid!)).toBe(true);
    const lines = LogLineListSchema.parse((await t.json("GET", `/v1/processes/${info.id}/logs`)).body).map((line) => line.text);
    expect(lines).toContain("Process killed (SIGKILL)");
    expect((await entries()).some((candidate) => candidate.id === info.id)).toBe(false);
  });

  test("DELETE /v1/processes/:id takes ?signal= and escalates a running SIGTERM stop", async () => {
    const info = await startProcess(STUBBORN, "escalate");
    const graceful = t.json("DELETE", restPaths.process(info.id));
    await Bun.sleep(200);
    const started = Date.now();
    const killed = await t.json("DELETE", restPaths.process(info.id, { signal: "SIGKILL" }));
    expect(killed.status).toBe(200);
    expect(ProcessInfoSchema.parse(killed.body).state).toBe("stopped");
    expect(Date.now() - started).toBeLessThan(2_500);
    expect((await graceful).status).toBe(200);
    expect((await t.json("DELETE", `${restPaths.process(info.id)}?signal=SIGINT`)).status).toBe(400);
  });

  test("SIGTERM stays the default", async () => {
    const info = await startProcess("sleep 30", "sleeper");
    const { entry } = await stop("process", info.id);
    expect(entry?.state).toBe("stopped");
  });

  test("terminals close with SIGKILL", async () => {
    const created = await t.json("POST", "/v1/terminals", { kind: "shell", cols: 80, rows: 24 });
    const terminal = TerminalInfoSchema.parse(created.body);
    expect((await entries()).find((entry) => entry.id === terminal.id)).toMatchObject({ kind: "terminal", pid: terminal.pid, canStop: true });
    const { entry } = await stop("terminal", terminal.id, "SIGKILL");
    expect(entry).toMatchObject({ state: "killed", canStop: false });
  });

  test("app runs: listed while running, SIGKILL ends a SIGTERM-ignoring server at once", async () => {
    const started = await t.json("POST", "/v1/projects/web/app-runs", { target: "web-dev" });
    expect(started.status).toBe(201);
    const run = AppRunSchema.parse(started.body);
    await waitFor(async () => (await t.json<{ state: string }>("GET", `/v1/app-runs/${run.id}`)).body.state === "ready", 15_000);
    const listed = (await entries()).find((entry) => entry.id === run.id);
    expect(listed).toMatchObject({ kind: "app-run", projectId: "web", state: "ready", canStop: true });
    expect(listed?.pid).not.toBeNull();

    const before = Date.now();
    const { entry } = await stop("app-run", run.id, "SIGKILL");
    expect(Date.now() - before).toBeLessThan(2_500);
    expect(entry).toMatchObject({ state: "killed", canStop: false });
    expect(AppRunSchema.parse((await t.json("GET", `/v1/app-runs/${run.id}`)).body).state).toBe("stopped");
  }, 20_000);

  test("agent runs: listed with their pid, SIGKILL cancels at once", async () => {
    const started = await t.json<{ id: string }>("POST", "/v1/agent/runs", { projectId: "app", prompt: "slow please" });
    expect(started.status).toBe(201);
    const listed = await waitFor(async () => (await entries()).find((entry) => entry.id === started.body.id));
    expect(listed).toMatchObject({ kind: "agent-run", name: "Claude agent run", detail: "slow please", state: "running", canStop: true });
    expect(listed.pid).not.toBeNull();
    const { entry } = await stop("agent-run", started.body.id, "SIGKILL");
    expect(entry).toMatchObject({ state: "killed", canStop: false });
    expect(processGone(listed.pid!)).toBe(true);
  });

  test("404 for unknown kinds and ids", async () => {
    expect((await t.json("DELETE", "/v1/runtime/nope/x")).status).toBe(404);
    expect((await stop("process", "prc_missing000")).status).toBe(404);
    expect((await stop("process", "garbage")).status).toBe(404);
    expect((await stop("agent-run", "run_missing000")).status).toBe(404);
    expect((await stop("browser", "424242")).status).toBe(404);
    expect((await stop("vnc", "session-999")).status).toBe(404);
  });
});

describe("Chromium", () => {
  function addBrowser(): void {
    procs.add(990_001, "chromium", 1, ["/usr/lib/chromium/chromium", "--remote-debugging-port=9333", "--user-data-dir=/home/dev/.config/chromium-tesseract"]);
    procs.add(990_002, "chromium", 990_001, ["/usr/lib/chromium/chromium", "--type=zygote"]);
    procs.add(990_003, "chromium", 990_002, ["/usr/lib/chromium/chromium", "--type=renderer"]);
  }

  test("lists only the browser process, with its tree's memory", async () => {
    addBrowser();
    const browsers = (await entries()).filter((entry) => entry.kind === "browser");
    expect(browsers).toHaveLength(1);
    expect(browsers[0]).toMatchObject({ id: "990001", name: "Chromium", pid: 990_001, supervised: false, canStop: true, memoryBytes: 3 * 256 * 4096 });
    expect(browsers[0]?.detail).toContain("DevTools 127.0.0.1:9333");
    expect(browsers[0]?.startedAt).not.toBeNull();
  });

  test("SIGTERM closes it through DevTools", async () => {
    addBrowser();
    cdpWorks = true;
    const { entry } = await stop("browser", "990001");
    expect(cdpCalls.at(-1)).toBe(9333);
    expect(entry).toMatchObject({ state: "stopped", canStop: false });
  });

  test("SIGTERM falls back to the signal when DevTools does not answer", async () => {
    addBrowser();
    cdpWorks = false;
    procs.signals.length = 0;
    const { entry } = await stop("browser", "990001", "SIGTERM");
    expect(procs.signals).toContainEqual([990_001, "SIGTERM"]);
    expect(entry?.state).toBe("stopped");
  });

  test("SIGKILL kills the whole tree", async () => {
    addBrowser();
    procs.signals.length = 0;
    const { entry } = await stop("browser", "990001", "SIGKILL");
    expect(procs.signals.filter(([, signal]) => signal === "SIGKILL").map(([pid]) => pid).sort()).toEqual([990_001, 990_002, 990_003]);
    expect(entry?.state).toBe("killed");
    for (const pid of [990_002, 990_003]) procs.fakes.delete(pid);
  });

  test("a graceful stop that is ignored ends in SIGKILL", async () => {
    addBrowser();
    cdpWorks = false;
    procs.dieOn = new Set(["SIGKILL"]);
    const { entry } = await stop("browser", "990001");
    expect(procs.signals.slice(-4).map(([, signal]) => signal)).toEqual(["SIGTERM", "SIGKILL", "SIGKILL", "SIGKILL"]);
    expect(entry?.state).toBe("killed");
    procs.dieOn = new Set(["SIGKILL", "SIGTERM"]);
    for (const pid of [990_002, 990_003]) procs.fakes.delete(pid);
  });
});

describe("VNC", () => {
  function addXvnc(): void {
    procs.add(990_100, "supervisord", 1, ["/usr/bin/python3", "/usr/bin/supervisord"]);
    procs.add(990_101, "Xvnc", 990_100, ["Xvnc", ":1"]);
  }

  test("lists Xvnc as supervised; SIGTERM goes through supervisorctl stop", async () => {
    addXvnc();
    const xvnc = (await entries()).find((entry) => entry.kind === "vnc" && entry.id === "xvnc");
    expect(xvnc).toMatchObject({ pid: 990_101, state: "running", supervised: true, canStop: true });
    const { entry } = await stop("vnc", "xvnc");
    expect(supervisorCalls).toContain("stop xvnc");
    expect(entry).toMatchObject({ state: "stopped", supervised: true });
  });

  test("SIGKILL kills Xvnc (supervisord restarts it)", async () => {
    addXvnc();
    const { entry } = await stop("vnc", "xvnc", "SIGKILL");
    expect(procs.signals.at(-1)).toEqual([990_101, "SIGKILL"]);
    expect(entry).toMatchObject({ state: "killed", supervised: true });
  });

  test("a stopped Xvnc is listed from supervisord and cannot be stopped", async () => {
    xvncStatus = { state: "stopped", pid: null };
    const xvnc = (await entries()).find((entry) => entry.id === "xvnc");
    expect(xvnc).toMatchObject({ pid: null, state: "stopped", canStop: false, supervised: true });
    expect((await stop("vnc", "xvnc")).status).toBe(404);
    xvncStatus = null;
    expect((await entries()).some((entry) => entry.id === "xvnc")).toBe(false);
  });

  test("bridge sessions are listed and closed", async () => {
    const socket = await t.socket("/v1/display/vnc", ["binary"]);
    await socket.waitFor(() => socket.messages.length > 0);
    const session = await waitFor(async () => (await entries()).find((entry) => entry.kind === "vnc" && entry.id.startsWith("session-")));
    expect(session).toMatchObject({ name: "VNC session", state: "connected", canStop: true, pid: null });
    const { entry } = await stop("vnc", session.id);
    expect(entry).toMatchObject({ state: "closed", canStop: false });
    expect((await socket.closed).code).toBe(1000);
    await waitFor(() => rfbSockets.size === 0);
    expect((await entries()).some((candidate) => candidate.id === session.id)).toBe(false);
  });

  test("SIGKILL drops a session without a close handshake", async () => {
    const socket = await t.socket("/v1/display/vnc");
    await socket.waitFor(() => socket.messages.length > 0);
    const session = await waitFor(async () => (await entries()).find((entry) => entry.id.startsWith("session-")));
    const { entry } = await stop("vnc", session.id, "SIGKILL");
    expect(entry?.state).toBe("killed");
    expect((await socket.closed).code).not.toBe(1000);
  });
});

describe("parseSupervisorStatus", () => {
  test("reads state and pid", () => {
    expect(parseSupervisorStatus("xvnc                             RUNNING   pid 42, uptime 1:02:03\n", "xvnc")).toEqual({ state: "running", pid: 42 });
    expect(parseSupervisorStatus("xvnc                             STOPPED   Oct 19 10:00 AM\n", "xvnc")).toEqual({ state: "stopped", pid: null });
    expect(parseSupervisorStatus("xvnc: ERROR (no such process)\n", "xvnc")).toBeNull();
    expect(parseSupervisorStatus("unix:///run/supervisor/supervisor.sock no such file\n", "xvnc")).toBeNull();
  });
});
