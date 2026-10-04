import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync } from "node:fs";
import { join } from "node:path";
import { createId, type AppRun, type ProcessInfo } from "@theone/protocol";
import type { Config } from "../../src/config";
import type { EventHub } from "../../src/core/events";
import { silentLogger } from "../../src/core/logger";
import type { AndroidLinkService } from "../../src/services/android-link";
import { AppRunService, flutterEventText } from "../../src/services/app-runs";
import type { DisplayService } from "../../src/services/display";
import type { IdentityService } from "../../src/services/identity";
import type { ProcessService, SpawnSpec } from "../../src/services/processes";
import type { ProjectService } from "../../src/services/projects";
import { makeTempDir, removeTempDirs, writeFiles } from "../helpers";

afterEach(removeTempDirs);

type Deferred = { promise: Promise<void>; resolve: () => void };

function deferred(): Deferred {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

type Harness = {
  service: AppRunService;
  published: AppRun[];
  spawned: SpawnSpec[];
  portGate: Deferred | null;
  hostGate: Deferred | null;
  portAsked: Deferred;
  hostAsked: Deferred;
  spawnFails: boolean;
};

function harness(): Harness {
  const root = makeTempDir("app-runs-unit");
  writeFiles(root, {
    "web/package.json": JSON.stringify({ name: "web", scripts: { dev: "vite" }, dependencies: { vite: "1" } }),
    "expo/package.json": JSON.stringify({ name: "expo", dependencies: { expo: "1" } }),
  });
  const h: Harness = {
    service: null as unknown as AppRunService,
    published: [],
    spawned: [],
    portGate: null,
    hostGate: null,
    portAsked: deferred(),
    hostAsked: deferred(),
    spawnFails: false,
  };
  const processes = {
    async assertPortFree() {
      h.portAsked.resolve();
      await h.portGate?.promise;
    },
    spawn(spec: SpawnSpec): ProcessInfo {
      h.spawned.push(spec);
      const info: ProcessInfo = {
        id: createId("process"),
        projectId: spec.projectId ?? null,
        name: spec.name,
        command: spec.command,
        cwd: spec.cwd,
        pid: null,
        port: spec.port ?? null,
        display: false,
        state: h.spawnFails ? "failed" : "running",
        exitCode: null,
        startedAt: new Date().toISOString(),
        endedAt: null,
      };
      if (h.spawnFails) spec.onExit?.({ ...info });
      return info;
    },
    async stop() {},
    logTail() {
      throw new Error("no logs");
    },
  };
  const identity = {
    async selfNode() {
      h.hostAsked.resolve();
      await h.hostGate?.promise;
      return null;
    },
  };
  const config = { display: ":987", flutterBin: "/nonexistent/flutter", publicUrl: "http://127.0.0.1:7700" } as unknown as Config;
  const hub = { publish: (event: { run: AppRun }) => h.published.push(event.run) } as unknown as EventHub;
  const projects = { require: (id: string) => ({ id, path: join(root, id) }) } as unknown as ProjectService;
  const android = { unavailableReason: () => null, ensureConnected: async () => true, serial: "127.0.0.1:15555" } as unknown as AndroidLinkService;
  h.service = new AppRunService(
    config,
    hub,
    processes as unknown as ProcessService,
    projects,
    {} as DisplayService,
    android,
    identity as unknown as IdentityService,
    silentLogger,
  );
  return h;
}

describe("app run lifecycle edges", () => {
  test("a stop while the port is being chosen resolves and nothing is spawned", async () => {
    const h = harness();
    h.portGate = deferred();
    const starting = h.service.start("web", { target: "web-dev" });
    await h.portAsked.promise;
    const [run] = h.service.list();
    expect(run).toMatchObject({ state: "starting", processIds: [] });

    const stopped = await h.service.stop(run!.id);
    expect(stopped).toMatchObject({ state: "stopped", error: null, processIds: [] });
    expect(stopped.endedAt).not.toBeNull();

    h.portGate.resolve();
    expect(await starting).toMatchObject({ id: run!.id, state: "stopped" });
    expect(h.spawned).toHaveLength(0);
    expect(h.published.at(-1)).toMatchObject({ id: run!.id, state: "stopped" });
    expect((await h.service.stop(run!.id)).state).toBe("stopped");
  });

  test("a stop while the run is being planned resolves and nothing is spawned", async () => {
    const h = harness();
    h.hostGate = deferred();
    const starting = h.service.start("expo", { target: "expo-device" });
    await h.hostAsked.promise;
    const [run] = h.service.list();
    expect((await h.service.stop(run!.id)).state).toBe("stopped");
    h.hostGate.resolve();
    expect((await starting).state).toBe("stopped");
    expect(h.spawned).toHaveLength(0);
  });

  test("a synchronous spawn failure reports the failed process id", async () => {
    const h = harness();
    h.spawnFails = true;
    const run = await h.service.start("web", { target: "web-dev" });
    expect(run.state).toBe("failed");
    expect(run.processIds).toHaveLength(1);
    const failed = h.published.find((entry) => entry.state === "failed");
    expect(failed?.processIds).toEqual(run.processIds);
  });
});

describe("expo slug", () => {
  const slugOf = async (appJson: unknown) => {
    const h = harness();
    const dir = makeTempDir("expo-slug");
    writeFiles(dir, { "app.json": JSON.stringify(appJson) });
    const service = h.service as unknown as { expoSlug(live: unknown): Promise<string | null> };
    return service.expoSlug({ cwd: dir, facts: { packageManager: "bun" } });
  };

  test("only slugs Expo allows reach the deep link", async () => {
    expect(await slugOf({ expo: { slug: "My-app2" } })).toBe("My-app2");
    expect(await slugOf({ expo: { slug: "evil://x?y" } })).toBeNull();
    expect(await slugOf({ expo: { slug: "-dash" } })).toBeNull();
    expect(await slugOf({ expo: { slug: "a b" } })).toBeNull();
  });
});

describe("flutter machine events", () => {
  test("app.stop and daemon.showMessage are logged", () => {
    expect(flutterEventText({ event: "app.stop", params: { appId: "a" } })).toBe("App stopped");
    expect(flutterEventText({ event: "app.stop", params: { appId: "a", error: "Gradle task failed" } })).toBe("App stopped: Gradle task failed");
    expect(flutterEventText({ event: "daemon.showMessage", params: { level: "error", title: "Unable to start", message: "No device" } })).toBe(
      "Error: Unable to start: No device",
    );
    expect(flutterEventText({ event: "daemon.showMessage", params: { level: "info", title: "Note" } })).toBe("Note");
    expect(flutterEventText({ event: "daemon.showMessage", params: {} })).toBeNull();
  });
});

describe("electron windows", () => {
  test("one search per poll, getwindowpid only for new windows", async () => {
    const bin = makeTempDir("xdotool");
    const log = join(bin, "calls.log");
    writeFiles(bin, {
      xdotool: [
        "#!/usr/bin/env bash",
        `echo "$*" >> ${JSON.stringify(log)}`,
        'case "$1" in',
        '  search) printf "101\\n102\\n" ;;',
        `  getwindowpid) if [[ "$2" == 101 ]]; then echo ${process.pid}; else echo 1; fi ;;`,
        "esac",
      ].join("\n"),
    });
    chmodSync(join(bin, "xdotool"), 0o755);
    const path = process.env.PATH;
    process.env.PATH = `${bin}:${path}`;
    try {
      const h = harness();
      const service = h.service as unknown as { windows(live: unknown): Promise<string[]> };
      const live = { pids: [process.pid], windowPids: new Map<string, number | null>() };
      expect(await service.windows(live)).toEqual(["101"]);
      expect(await service.windows(live)).toEqual(["101"]);
      const calls = (await Bun.file(log).text()).trim().split("\n");
      expect(calls.filter((call) => call.startsWith("search"))).toEqual(["search --onlyvisible --name .*", "search --onlyvisible --name .*"]);
      expect(calls.filter((call) => call.startsWith("getwindowpid")).sort()).toEqual(["getwindowpid 101", "getwindowpid 102"]);
    } finally {
      process.env.PATH = path;
    }
  });
});
