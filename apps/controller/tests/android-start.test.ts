import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { AppRun, EmulatorInfo, RunTargetInfo } from "@tesseract/protocol";
import { expoGoCompatible } from "../src/services/app-runs";
import { installFixture, makeTempDir, removeTempDirs, startTestController, waitFor, writeFiles, type TestController, type WsClient } from "./helpers";

// A Mac host: the emulator is never network isolated, and it starts only when a run asks for it.
const RUNNING: EmulatorInfo = {
  state: "running",
  avd: "Pixel_9_Pro_API_35",
  serial: "emulator-5554",
  managed: false,
  isolated: false,
  width: 1280,
  height: 2856,
  startedAt: "2026-11-06T10:00:00.000Z",
  error: null,
};
const STOPPED: EmulatorInfo = { ...RUNNING, state: "stopped", serial: null, width: null, height: null, startedAt: null };

let t: TestController;
let host: WsClient;
let projects: string;

function freePort(): number {
  const probe = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const port = probe.port;
  probe.stop(true);
  return port;
}

async function expoAndroid(): Promise<RunTargetInfo | undefined> {
  const { body } = await t.json<RunTargetInfo[]>("GET", "/v1/projects/expo/run-targets");
  return body.find((entry) => entry.target === "expo-android");
}

async function runOf(id: string): Promise<AppRun> {
  return (await t.json<AppRun>("GET", `/v1/app-runs/${id}`)).body;
}

async function output(run: AppRun): Promise<string> {
  const id = run.processIds[0];
  if (!id) return "";
  const { body } = await t.json<unknown>("GET", `/v1/processes/${id}/logs`);
  return JSON.stringify(body);
}

beforeAll(async () => {
  const workspace = makeTempDir("android-start");
  const adbDir = makeTempDir("android-start-adb");
  projects = join(workspace, "projects");
  writeFiles(projects, {
    "expo/package.json": JSON.stringify({ name: "expo", dependencies: { expo: "1" } }),
    "expo/bun.lock": "{}",
  });
  mkdirSync(join(projects, "expo", "node_modules", ".bin"), { recursive: true });
  installFixture(join(projects, "expo", "node_modules", ".bin"), "fake-expo.ts", "expo");
  t = await startTestController({
    workspace,
    env: { TESSERACT_ADB: installFixture(adbDir, "fake-adb.sh", "adb"), TESSERACT_ADB_TUNNEL_PORT: String(freePort()) },
    controller: { androidLink: { pingIntervalMs: 100, reconnectIntervalMs: 300 }, appRuns: { readyPollMs: 50 } },
  });
  host = await t.socket("/v1/android/link");
  host.send({ type: "hello", hostId: "mac-mini", version: "1.0.0" });
  host.send({ type: "emulator", emulator: STOPPED });
  await waitFor(async () => (await t.json<{ hostId: string | null }>("GET", "/v1/android")).body.hostId === "mac-mini");
});

afterAll(async () => {
  await t.stop();
  removeTempDirs();
});

describe("Android runs on an unisolated host emulator that is not running yet", () => {
  test("expo-android is available while the emulator is stopped", async () => {
    expect(await expoAndroid()).toMatchObject({ available: true, reason: null });
  });

  test("a run asks the host to start the emulator, waits for it, then opens the app in Expo Go", async () => {
    const started = await t.json<AppRun>("POST", "/v1/projects/expo/app-runs", { target: "expo-android" });
    expect(started.status).toBe(201);
    expect(started.body).toMatchObject({ state: "starting", processIds: [] });

    const request = await host.waitFor<{ type: string; requestId: string }>((message) => message.type === "start");
    host.send({ type: "started", requestId: request.requestId, ok: true, error: null });
    host.send({ type: "emulator", emulator: { ...RUNNING, state: "starting" } });
    await Bun.sleep(100);
    expect((await runOf(started.body.id)).processIds).toEqual([]);
    host.send({ type: "emulator", emulator: RUNNING });

    const ready = await waitFor(async () => {
      const run = await runOf(started.body.id);
      return run.state === "ready" ? run : null;
    }, 15_000);
    const log = await output(ready);
    expect(log).toContain("ARGS: start --go --android --port");
    expect(log).toContain("HOSTNAME: 127.0.0.1 CI: 1");
    await t.json("DELETE", `/v1/app-runs/${ready.id}`);
  });

  test("a start the host refuses fails the run with its reason", async () => {
    host.send({ type: "emulator", emulator: STOPPED });
    await waitFor(async () => (await t.json<{ emulator: EmulatorInfo | null }>("GET", "/v1/android")).body.emulator?.state === "stopped");
    const before = host.messages.length;
    const started = await t.json<AppRun>("POST", "/v1/projects/expo/app-runs", { target: "expo-android" });
    const request = await waitFor(() => host.messages.slice(before).find((message) => (message as { type?: string }).type === "start") as { requestId: string } | undefined);
    host.send({ type: "started", requestId: request.requestId, ok: false, error: "The host has no Android Virtual Device" });
    const failed = await waitFor(async () => {
      const run = await runOf(started.body.id);
      return run.state === "failed" ? run : null;
    });
    expect(failed).toMatchObject({ error: "The host has no Android Virtual Device", processIds: [] });
  });

  test("Expo Go is used only when the project needs no native build", () => {
    const cwd = join(projects, "expo");
    expect(expoGoCompatible({ deps: new Set(["expo"]) }, cwd)).toBe(true);
    expect(expoGoCompatible({ deps: new Set(["expo", "expo-dev-client"]) }, cwd)).toBe(false);
    mkdirSync(join(cwd, "android"));
    expect(expoGoCompatible({ deps: new Set(["expo"]) }, cwd)).toBe(false);
  });
});
