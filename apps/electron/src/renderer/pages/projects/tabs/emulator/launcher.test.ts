import type { AppRun, HostAndroidStatus, RunTargetInfo } from "@theone/protocol";
import { sampleAppRun, sampleHostAndroidStatus, sampleSandboxAndroidStatus } from "@theone/protocol/fixtures";
import { describe, expect, it, vi } from "vitest";
import { IpcError } from "../../../../../shared/ipc-types";
import { hostAndroid, HostRequestError, prepareEmulator, runOnEmulator, type HostAndroid, type SandboxApi, type Timing } from "./launcher";

const SANDBOX = { url: "http://100.64.0.2:7700", token: "t" };

function fakeTiming(): Timing {
  let now = 0;
  return { now: () => now, sleep: async (ms) => void (now += ms) };
}

const target: RunTargetInfo = { target: "expo-android", label: "Android", dir: null, available: true, reason: null, viewer: "android", actions: [] };

function sandbox(runs: AppRun[] = [], targets: RunTargetInfo[] = [target]): SandboxApi & { started: string[] } {
  const started: string[] = [];
  return {
    started,
    listRunTargets: async () => targets,
    listAppRuns: async () => runs,
    startAppRun: async (_projectId, body) => {
      started.push(body.target);
      return { ...sampleAppRun, target: body.target, state: "starting" };
    },
    getAndroidStatus: async () => sampleSandboxAndroidStatus,
  };
}

function fakeHost(states: HostAndroidStatus[]): HostAndroid & { calls: string[] } {
  const calls: string[] = [];
  let index = 0;
  return {
    calls,
    status: async () => states[Math.min(index++, states.length - 1)] ?? sampleHostAndroidStatus,
    startEmulator: async (avd) => void calls.push(`start:${avd}`),
    stopEmulator: async () => void calls.push("stop"),
    linkSandbox: async (url) => void calls.push(`link:${url}`),
  };
}

const ready: HostAndroidStatus = { ...sampleHostAndroidStatus, link: { ...sampleHostAndroidStatus.link, sandboxUrl: SANDBOX.url } };
const stopped: HostAndroidStatus = { ...ready, emulator: { ...ready.emulator, state: "stopped" } };
const failed: HostAndroidStatus = { ...ready, emulator: { ...ready.emulator, state: "failed", error: "no kvm" } };

describe("runOnEmulator", () => {
  it("reuses a live run", async () => {
    const api = sandbox([{ ...sampleAppRun, target: "expo-android", state: "ready" }]);
    const result = await runOnEmulator(api, "p", "expo-android");
    expect(result.started).toBe(false);
    expect(api.started).toEqual([]);
    expect(result.serial).toBe(sampleSandboxAndroidStatus.emulator?.serial);
  });

  it("starts a run when none is live", async () => {
    const api = sandbox();
    const result = await runOnEmulator(api, "p", "expo-android");
    expect(result.started).toBe(true);
    expect(api.started).toEqual(["expo-android"]);
  });
});

describe("prepareEmulator", () => {
  it("stops, starts, links and waits", async () => {
    const host = fakeHost([stopped, ready]);
    const stages: string[] = [];
    await prepareEmulator({
      host,
      client: sandbox(),
      sandbox: SANDBOX,
      projectId: "p",
      target: "expo-android",
      plan: { stop: true, avd: "Pixel", link: true, replaces: null, blocked: null },
      onStage: (stage) => stages.push(stage),
      timing: fakeTiming(),
    });
    expect(stages).toEqual(["stopping", "starting", "linking", "booting"]);
    expect(host.calls).toEqual(["stop", "start:Pixel", `link:${SANDBOX.url}`]);
  });

  it("fails when the emulator fails to boot", async () => {
    await expect(
      prepareEmulator({
        host: fakeHost([failed]),
        client: sandbox(),
        sandbox: SANDBOX,
        projectId: "p",
        target: "expo-android",
        plan: { stop: false, avd: null, link: false, replaces: null, blocked: null },
        onStage: vi.fn(),
        timing: fakeTiming(),
      }),
    ).rejects.toThrow("The emulator failed: no kvm");
  });

  it("times out when the sandbox never offers the target", async () => {
    await expect(
      prepareEmulator({
        host: fakeHost([ready]),
        client: sandbox([], [{ ...target, available: false }]),
        sandbox: SANDBOX,
        projectId: "p",
        target: "expo-android",
        plan: { stop: false, avd: null, link: false, replaces: null, blocked: null },
        onStage: vi.fn(),
        timing: fakeTiming(),
      }),
    ).rejects.toThrow("The sandbox did not pick up the emulator within 60 seconds");
  });

  it("times out a slow boot after 6 minutes", async () => {
    await expect(
      prepareEmulator({
        host: fakeHost([stopped]),
        client: sandbox(),
        sandbox: SANDBOX,
        projectId: "p",
        target: "expo-android",
        plan: { stop: false, avd: null, link: false, replaces: null, blocked: null },
        onStage: vi.fn(),
        timing: fakeTiming(),
      }),
    ).rejects.toThrow("The emulator did not boot within 6 minutes");
  });
});

describe("hostAndroid", () => {
  it("wraps host failures and flags auth errors", async () => {
    const host = hostAndroid({
      status: () => Promise.reject(new IpcError("forbidden", "Unlock the host shell with its PIN first", "pin-session")),
      startEmulator: () => Promise.reject(new Error("down")),
      stopEmulator: async () => undefined,
      linkSandbox: async () => undefined,
    });
    const auth = await host.status().catch((error: unknown) => error);
    expect(auth).toBeInstanceOf(HostRequestError);
    expect((auth as HostRequestError).auth).toBe(true);
    const other = await host.startEmulator("A").catch((error: unknown) => error);
    expect((other as HostRequestError).auth).toBe(false);
    expect((other as HostRequestError).message).toBe("down");
  });
});
