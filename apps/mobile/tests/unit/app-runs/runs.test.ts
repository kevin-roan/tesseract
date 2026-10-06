import type { AppRun, RunTargetInfo } from "@theone/protocol";
import { sampleAppRun, sampleExpoAppRun, sampleRunTargets } from "@theone/protocol/fixtures";

import {
  appRunEntries,
  appRunMeta,
  canStart,
  deepLinkFor,
  emulatorActionFor,
  emulatorDestination,
  isActiveAppRun,
  isUnreachable,
  openPlanFor,
  runActions,
  viewerKindOf,
} from "@/features/app-runs/utils/runs";

const displayRun: AppRun = { ...sampleAppRun, id: "app_display", target: "flutter-linux", viewer: { kind: "display" }, actions: ["reload", "restart", "focus"] };
const androidRun: AppRun = { ...sampleAppRun, id: "app_android", target: "flutter-android", state: "starting", viewer: null, readyAt: null };

describe("openPlanFor", () => {
  it("opens a ready url run in the in-app preview", () => {
    expect(openPlanFor(sampleAppRun)).toEqual({ kind: "preview", url: "http://100.64.0.2:8090" });
  });

  it("does not open a url run without a phone address or before it is ready", () => {
    const unreachable: AppRun = { ...sampleAppRun, viewer: { kind: "url", url: null, localUrl: "http://127.0.0.1:8090" } };
    expect(openPlanFor(unreachable)).toBeNull();
    expect(isUnreachable(unreachable)).toBe(true);
    expect(openPlanFor({ ...sampleAppRun, state: "starting", viewer: null })).toBeNull();
    expect(isUnreachable(sampleAppRun)).toBe(false);
  });

  it("prefers the dev client deep link and falls back to Expo Go", () => {
    expect(openPlanFor(sampleExpoAppRun)).toEqual({
      kind: "deeplink",
      url: "exp+expo-hello://expo-development-client/?url=http%3A%2F%2F100.64.0.2%3A8081",
      manifestUrl: "http://100.64.0.2:8081",
    });
    const viewer = { kind: "deeplink" as const, devClientUrl: null, expoGoUrl: "exp://100.64.0.2:8081", manifestUrl: "http://100.64.0.2:8081" };
    expect(deepLinkFor(viewer)).toBe("exp://100.64.0.2:8081");
  });

  it("shows the display, focusing the window only once ready", () => {
    expect(openPlanFor(displayRun)).toEqual({ kind: "display", focus: true });
    expect(openPlanFor({ ...displayRun, state: "starting", viewer: null })).toEqual({ kind: "display", focus: false });
    expect(openPlanFor({ ...displayRun, actions: [] })).toEqual({ kind: "display", focus: false });
  });

  it("opens the emulator while an android run is alive", () => {
    expect(viewerKindOf(androidRun)).toBe("android");
    expect(openPlanFor(androidRun)).toEqual({ kind: "android" });
    expect(openPlanFor({ ...androidRun, state: "failed" })).toBeNull();
  });

  it("never opens test runs", () => {
    expect(openPlanFor({ ...sampleAppRun, target: "test", viewer: { kind: "none" } })).toBeNull();
  });
});

describe("appRunEntries", () => {
  it("pairs every offered target with its newest run and appends runs of unknown targets", () => {
    const older: AppRun = { ...sampleAppRun, id: "app_old", startedAt: "2026-09-22T10:00:00.000Z" };
    const orphan: AppRun = { ...sampleExpoAppRun, projectId: "flutter-hello" };
    const entries = appRunEntries(sampleRunTargets, [older, sampleAppRun, orphan]);

    expect(entries.map((entry) => entry.target)).toEqual(["flutter-web", "flutter-linux", "flutter-android", "test", "expo-device"]);
    expect(entries[0].run?.id).toBe(sampleAppRun.id);
    expect(entries[1].run).toBeNull();
    expect(entries[4]).toMatchObject({ label: "expo-device", viewer: "deeplink", info: null });
  });
});

describe("run helpers", () => {
  it("only starts an available target with no live run", () => {
    const [web, , android] = appRunEntries(sampleRunTargets, []);
    expect(canStart(web)).toBe(true);
    expect(canStart(android)).toBe(false);
    expect(canStart({ ...web, run: sampleAppRun })).toBe(false);
    expect(canStart({ ...web, run: { ...sampleAppRun, state: "exited" } })).toBe(true);
  });

  it("offers actions only on ready runs", () => {
    expect(runActions(sampleAppRun)).toEqual(["reload", "restart"]);
    expect(runActions(androidRun)).toEqual([]);
    expect(isActiveAppRun(androidRun)).toBe(true);
    expect(isActiveAppRun({ ...sampleAppRun, state: "stopped" })).toBe(false);
  });

  it("describes the port and when the run became ready", () => {
    const now = Date.parse(sampleAppRun.readyAt!) + 120_000;
    expect(appRunMeta(sampleAppRun, now)).toMatch(/^port 8090 · ready /);
    expect(appRunMeta({ ...androidRun, port: null }, now)).toMatch(/^started /);
  });
});

describe("emulatorActionFor", () => {
  const expoAndroid: RunTargetInfo = {
    target: "expo-android",
    label: "Android emulator · apps/mobile",
    dir: "apps/mobile",
    available: true,
    reason: null,
    viewer: "android",
    actions: ["reload", "restart"],
  };
  const webDev: RunTargetInfo = { ...sampleRunTargets[0], target: "web-dev", label: "Web" };
  const expoRun: AppRun = { ...androidRun, id: "app_expo", target: "expo-android", dir: "apps/mobile" };

  it("offers nothing for a project without an android target", () => {
    expect(emulatorActionFor(appRunEntries([webDev], [sampleAppRun]))).toBeNull();
    expect(emulatorActionFor(appRunEntries(sampleRunTargets.filter((info) => info.viewer !== "android"), []))).toBeNull();
  });

  it("opens on the emulator by starting an available target", () => {
    const action = emulatorActionFor(appRunEntries([webDev, expoAndroid], []));
    expect(action).toMatchObject({ kind: "start", entry: { target: "expo-android", label: "Android emulator · apps/mobile" } });
    expect(emulatorDestination(action!)).toBe("android");
    expect(emulatorActionFor(appRunEntries([expoAndroid], [{ ...expoRun, state: "exited" }]))?.kind).toBe("start");
  });

  it("shows the emulator while a run of the target is live, even when the target is unavailable now", () => {
    for (const state of ["starting", "ready"] as const) {
      const action = emulatorActionFor(appRunEntries([{ ...expoAndroid, available: false, reason: "Start the emulator on the host" }], [{ ...expoRun, state }]));
      expect(action).toMatchObject({ kind: "show", run: { id: expoRun.id } });
      expect(emulatorDestination(action!)).toBe("android");
    }
  });

  it("shows a live run of a target no longer offered", () => {
    expect(emulatorActionFor(appRunEntries([], [expoRun]))).toMatchObject({ kind: "show", entry: { info: null } });
    expect(emulatorActionFor(appRunEntries([], [{ ...expoRun, state: "failed" }]))).toBeNull();
  });

  it("routes to the host emulator controls with the reason while no target can start", () => {
    const action = emulatorActionFor(appRunEntries(sampleRunTargets, []));
    expect(action).toMatchObject({ kind: "setup", entry: { target: "flutter-android" }, reason: "Link the host Android emulator first" });
    expect(emulatorDestination(action!)).toBe("host");
  });

  it("prefers a startable target over an unavailable one", () => {
    const blocked: RunTargetInfo = { ...expoAndroid, target: "rn-android", available: false, reason: "Start the emulator on the host" };
    expect(emulatorActionFor(appRunEntries([blocked, expoAndroid], []))).toMatchObject({ kind: "start", entry: { target: "expo-android" } });
  });
});
