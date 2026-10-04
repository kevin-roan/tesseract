import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import {
  AndroidLinkHostMessageSchema,
  AndroidLinkSandboxMessageSchema,
  AndroidScreenClientMessageSchema,
  AndroidScreenQuerySchema,
  AndroidScreenServerMessageSchema,
  AppRunActionRequestSchema,
  AppRunListSchema,
  AppRunSchema,
  createId,
  FRAMEWORKS,
  HostAndroidStatusSchema,
  ID_PREFIXES,
  isFinalAppRunState,
  LinkSandboxSchema,
  RUN_TARGET_ACTIONS,
  RUN_TARGET_VIEWERS,
  RUN_TARGETS,
  restPaths,
  routePatterns,
  RunTargetListSchema,
  SandboxAndroidStatusSchema,
  SERVER_EVENT_TYPES,
  ServerEventSchema,
  StartAppRunSchema,
  StartEmulatorSchema,
  uiPaths,
  wsPaths,
} from "../src/index";
import {
  sampleAppRun,
  sampleExpoAppRun,
  sampleHostAndroidStatus,
  sampleRunTargets,
  sampleSandboxAndroidStatus,
} from "../src/fixtures";

function roundTrip(schema: z.ZodType, value: unknown) {
  expect(schema.parse(JSON.parse(JSON.stringify(value))) as unknown).toEqual(value);
}

function rejects(schema: z.ZodType, value: unknown) {
  expect(schema.safeParse(value).success).toBe(false);
}

describe("app runs", () => {
  test("constants", () => {
    expect(FRAMEWORKS).toContain("flutter");
    expect(ID_PREFIXES.appRun).toBe("app_");
    expect(ID_PREFIXES.adbStream).toBe("adb_");
    expect(SERVER_EVENT_TYPES).toContain("app.updated");
    expect(Object.keys(RUN_TARGET_VIEWERS).sort()).toEqual([...RUN_TARGETS].sort());
    expect(Object.keys(RUN_TARGET_ACTIONS).sort()).toEqual([...RUN_TARGETS].sort());
    expect(isFinalAppRunState("ready")).toBe(false);
    expect(isFinalAppRunState("exited")).toBe(true);
  });

  test("round-trips", () => {
    roundTrip(RunTargetListSchema, sampleRunTargets);
    roundTrip(AppRunSchema, sampleAppRun);
    roundTrip(AppRunSchema, sampleExpoAppRun);
    roundTrip(AppRunSchema, { ...sampleAppRun, state: "starting", viewer: null, readyAt: null });
    roundTrip(AppRunSchema, { ...sampleAppRun, target: "flutter-android", viewer: { kind: "android", serial: "127.0.0.1:15555" } });
    roundTrip(AppRunListSchema, [sampleAppRun]);
    roundTrip(ServerEventSchema, { type: "app.updated", run: sampleAppRun });
  });

  test("rejects", () => {
    rejects(AppRunSchema, { ...sampleAppRun, id: "run_123" });
    rejects(AppRunSchema, { ...sampleAppRun, target: "ios" });
    rejects(AppRunSchema, { ...sampleAppRun, viewer: { kind: "url" } });
    rejects(AppRunSchema, { ...sampleAppRun, viewer: { kind: "vnc" } });
    rejects(StartAppRunSchema, { target: "web-dev", port: 0 });
    rejects(AppRunActionRequestSchema, { action: "hot-reload" });
    expect(StartAppRunSchema.parse({ target: "web-dev" })).toEqual({ target: "web-dev" });
    rejects(ServerEventSchema, { type: "app.updated" });
  });

  test("routes", () => {
    expect(restPaths.projectRunTargets("app")).toBe("/v1/projects/app/run-targets");
    expect(restPaths.projectAppRuns("app")).toBe("/v1/projects/app/app-runs");
    expect(restPaths.appRuns({ projectId: "app" })).toBe("/v1/app-runs?projectId=app");
    expect(restPaths.appRunActions("app_1")).toBe("/v1/app-runs/app_1/actions");
    expect(routePatterns.rest.appRun).toBe("/v1/app-runs/:id");
    expect(wsPaths.androidLinkStream("adb_1")).toBe("/v1/android/link/streams/adb_1");
    expect(wsPaths.androidScreen({ maxSize: 1280 })).toBe("/v1/android/screen?maxSize=1280");
    expect(uiPaths.android({ ticket: "t", maxSize: 1280 })).toBe("/ui/android#ticket=t&maxSize=1280");
    expect(uiPaths.android({ ticket: "t" })).toBe("/ui/android#ticket=t");
  });
});

describe("android", () => {
  test("status round-trips", () => {
    roundTrip(HostAndroidStatusSchema, sampleHostAndroidStatus);
    roundTrip(SandboxAndroidStatusSchema, sampleSandboxAndroidStatus);
    roundTrip(SandboxAndroidStatusSchema, { linked: false, hostId: null, emulator: null, adbSerial: null, adbConnected: false });
    rejects(HostAndroidStatusSchema, { ...sampleHostAndroidStatus, emulator: { ...sampleHostAndroidStatus.emulator, state: "booting" } });
  });

  test("requests", () => {
    expect(StartEmulatorSchema.parse({ avd: "Pixel_8_API_35", coldBoot: true })).toEqual({ avd: "Pixel_8_API_35", coldBoot: true });
    rejects(StartEmulatorSchema, { avd: "" });
    rejects(StartEmulatorSchema, { avd: "-wipe-data x" });
    expect(LinkSandboxSchema.safeParse({ sandboxUrl: "https://sandbox.ts.net:7700", token: "t" }).success).toBe(true);
    rejects(LinkSandboxSchema, { sandboxUrl: "ftp://sandbox", token: "t" });
    rejects(LinkSandboxSchema, { sandboxUrl: "sandbox:7700", token: "t" });
    rejects(LinkSandboxSchema, { sandboxUrl: "http://sandbox:7700", token: "" });
    rejects(LinkSandboxSchema, { sandboxUrl: "https://user:pass@sandbox.ts.net", token: "t" });
    rejects(LinkSandboxSchema, { sandboxUrl: "https://user@sandbox.ts.net", token: "t" });
    rejects(LinkSandboxSchema, { sandboxUrl: "https://sandbox.ts.net/#frag", token: "t" });
    expect(LinkSandboxSchema.safeParse({ sandboxUrl: "https://sandbox.ts.net/", token: "t" }).success).toBe(true);
  });

  test("link messages", () => {
    const streamId = createId("adbStream");
    roundTrip(AndroidLinkHostMessageSchema, { type: "hello", hostId: "workstation", version: "0.1.0" });
    roundTrip(AndroidLinkHostMessageSchema, { type: "emulator", emulator: sampleHostAndroidStatus.emulator });
    roundTrip(AndroidLinkHostMessageSchema, { type: "refuse", streamId, message: "Emulator is not running" });
    roundTrip(AndroidLinkHostMessageSchema, { type: "pong" });
    roundTrip(AndroidLinkSandboxMessageSchema, { type: "open", streamId });
    roundTrip(AndroidLinkSandboxMessageSchema, { type: "ping" });
    rejects(AndroidLinkSandboxMessageSchema, { type: "open", streamId: "prc_1" });
    rejects(AndroidLinkHostMessageSchema, { type: "open", streamId });
  });

  test("screen messages", () => {
    const touch = { type: "touch", action: "down", pointerId: 0, x: 10.5, y: 20, width: 1080, height: 2400, pressure: 1 };
    roundTrip(AndroidScreenClientMessageSchema, touch);
    roundTrip(AndroidScreenClientMessageSchema, { type: "scroll", x: 1, y: 2, width: 100, height: 200, hscroll: 0, vscroll: -1.5 });
    roundTrip(AndroidScreenClientMessageSchema, { type: "key", key: "app_switch" });
    roundTrip(AndroidScreenClientMessageSchema, { type: "text", text: "hello" });
    roundTrip(AndroidScreenClientMessageSchema, { type: "rotate" });
    rejects(AndroidScreenClientMessageSchema, { ...touch, pointerId: 10 });
    rejects(AndroidScreenClientMessageSchema, { ...touch, pointerId: 1.5 });
    rejects(AndroidScreenClientMessageSchema, { ...touch, pressure: 2 });
    rejects(AndroidScreenClientMessageSchema, { ...touch, x: Number.POSITIVE_INFINITY });
    rejects(AndroidScreenClientMessageSchema, { ...touch, width: 0 });
    rejects(AndroidScreenClientMessageSchema, { ...touch, height: 10.5 });
    rejects(AndroidScreenClientMessageSchema, { ...touch, action: "tap" });
    rejects(AndroidScreenClientMessageSchema, { type: "scroll", x: 1, y: 2, width: 100, height: 200, hscroll: 0, vscroll: 17 });
    rejects(AndroidScreenClientMessageSchema, { type: "key", key: "menu" });
    rejects(AndroidScreenClientMessageSchema, { type: "text", text: "x".repeat(301) });
    roundTrip(AndroidScreenServerMessageSchema, { type: "meta", deviceName: "sdk_gphone64", width: 1080, height: 2400 });
    roundTrip(AndroidScreenServerMessageSchema, { type: "size", width: 2400, height: 1080 });
    roundTrip(AndroidScreenServerMessageSchema, { type: "error", message: "Emulator is not running" });
    expect(AndroidScreenQuerySchema.parse({ ticket: "t", maxSize: "1280" })).toEqual({ ticket: "t", maxSize: 1280 });
    rejects(AndroidScreenQuerySchema, { ticket: "t", maxSize: "0" });
  });
});
