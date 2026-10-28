import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import {
  BootSimulatorSchema,
  createId,
  DecideIosInstallSchema,
  DEFAULT_IOS_STREAM,
  DeviceScreenServerMessageSchema,
  IosStreamSettingsSchema,
  UpdateIosStreamSchema,
  DeviceScreenClientMessageSchema,
  HostIosStatusSchema,
  ID_PREFIXES,
  IOS_URL_REFUSALS,
  iosOpenUrlRefusal,
  IosLinkHostMessageSchema,
  IosLinkSandboxMessageSchema,
  IosLinkStreamQuerySchema,
  IosScreenQuerySchema,
  isExpoGoUrl,
  isIdOfKind,
  PAGE_MESSAGES,
  restPaths,
  routePatterns,
  SandboxIosStatusSchema,
  AppRunSchema,
  InstallOnSimulatorSchema,
  IosLinkRequestSchema,
  RUN_TARGET_VIEWERS,
  RUN_TARGET_DEFAULT_PORTS,
  DEFAULT_STOP_SIGNAL,
  STOP_SIGNALS,
  StopSignalQuerySchema,
  uiPaths,
  wsPaths,
} from "../src/index";
import { sampleHostIosStatus, sampleIosAppRun, sampleIosInstall, sampleSandboxIosStatus, sampleSimDevice } from "../src/fixtures";

function roundTrip(schema: z.ZodType, value: unknown) {
  expect(schema.parse(JSON.parse(JSON.stringify(value))) as unknown).toEqual(value);
}

function rejects(schema: z.ZodType, value: unknown) {
  expect(schema.safeParse(value).success).toBe(false);
}

const UDID = sampleSimDevice.udid;

describe("ios routes", () => {
  test("paths and patterns", () => {
    expect(restPaths.ios()).toBe("/v1/ios");
    expect(restPaths.iosSimulator()).toBe("/v1/ios/simulator");
    expect(restPaths.iosLink()).toBe("/v1/ios/link");
    expect(restPaths.iosInstalls()).toBe("/v1/ios/installs");
    expect(restPaths.iosInstall("ins_1")).toBe("/v1/ios/installs/ins_1");
    expect(routePatterns.rest.iosInstall).toBe("/v1/ios/installs/:id");
    expect(wsPaths.iosLink()).toBe("/v1/ios/link");
    expect(wsPaths.iosLinkStream("ios_1", { port: 8081 })).toBe("/v1/ios/link/streams/ios_1?port=8081");
    expect(routePatterns.ws.iosLinkStream).toBe("/v1/ios/link/streams/:id");
    expect(wsPaths.iosScreen({ maxSize: 720, udid: UDID })).toBe(`/v1/ios/screen?maxSize=720&udid=${UDID}`);
    expect(uiPaths.ios({ ticket: "t", maxSize: 1280 })).toBe("/ui/ios#ticket=t&maxSize=1280");
    expect(wsPaths.iosScreen({ maxSize: 720, codec: "h264" })).toBe("/v1/ios/screen?maxSize=720&codec=h264");
    expect(uiPaths.ios({ ticket: "t", codec: "h264" })).toBe("/ui/ios#ticket=t&codec=h264");
    expect(restPaths.iosStream()).toBe("/v1/ios/stream");
    expect(routePatterns.rest.iosStream).toBe("/v1/ios/stream");
    expect(routePatterns.ui.ios).toBe("/ui/ios");
    expect(PAGE_MESSAGES.iosState).toBe("ios-state");
    expect(PAGE_MESSAGES.iosNeedTicket).toBe("ios-need-ticket");
  });

  test("stream and install ids", () => {
    expect(ID_PREFIXES.iosStream).toBe("ios_");
    expect(isIdOfKind("iosStream", createId("iosStream"))).toBe(true);
    expect(isIdOfKind("iosInstall", createId("iosInstall"))).toBe(true);
    expect(isIdOfKind("iosRequest", createId("iosRequest"))).toBe(true);
  });
});

describe("ios schemas", () => {
  test("status round trips", () => {
    roundTrip(HostIosStatusSchema, sampleHostIosStatus);
    roundTrip(SandboxIosStatusSchema, sampleSandboxIosStatus);
    roundTrip(HostIosStatusSchema, {
      ...sampleHostIosStatus,
      available: false,
      reason: "iOS Simulator support is off",
      reasonCode: "disabled",
      devices: [],
      booted: null,
      installs: [],
    });
    rejects(HostIosStatusSchema, { ...sampleHostIosStatus, isolation: "netns" });
    rejects(HostIosStatusSchema, { ...sampleHostIosStatus, reasonCode: "broken" });
    rejects(HostIosStatusSchema, { ...sampleHostIosStatus, booted: { ...sampleSimDevice, state: "Booted" } });
  });

  test("requests and queries", () => {
    roundTrip(BootSimulatorSchema, { udid: UDID });
    rejects(BootSimulatorSchema, { udid: "booted" });
    rejects(BootSimulatorSchema, { udid: "--set /tmp" });
    roundTrip(DecideIosInstallSchema, { approve: false });
    expect(IosScreenQuerySchema.parse({ ticket: "t", maxSize: "720" })).toEqual({ ticket: "t", maxSize: 720 });
    rejects(IosScreenQuerySchema, { ticket: "t", udid: "x" });
    expect(IosLinkStreamQuerySchema.parse({ ticket: "t", port: "8081" })).toEqual({ ticket: "t", port: 8081 });
    rejects(IosLinkStreamQuerySchema, { ticket: "t", port: "22" });
    roundTrip(DeviceScreenClientMessageSchema, { type: "key", key: "home" });
  });

  test("stream settings and screen codec", () => {
    roundTrip(IosStreamSettingsSchema, DEFAULT_IOS_STREAM);
    roundTrip(IosStreamSettingsSchema, { ...DEFAULT_IOS_STREAM, encoding: "mjpeg", maxSize: 1280 });
    expect(IosStreamSettingsSchema.parse({ ...DEFAULT_IOS_STREAM, device: "emulator-5554" })).toEqual(DEFAULT_IOS_STREAM);
    rejects(IosStreamSettingsSchema, { ...DEFAULT_IOS_STREAM, bitRate: 1 });
    rejects(IosStreamSettingsSchema, { ...DEFAULT_IOS_STREAM, encoding: "vp8" });
    rejects(IosStreamSettingsSchema, { ...DEFAULT_IOS_STREAM, keyFrameInterval: 0 });
    expect(UpdateIosStreamSchema.parse({ maxFps: 30 })).toEqual({ maxFps: 30 });
    rejects(UpdateIosStreamSchema, { jpegQuality: 0 });
    expect(IosScreenQuerySchema.parse({ ticket: "t", udid: UDID, codec: "h264" })).toEqual({ ticket: "t", udid: UDID, codec: "h264" });
    rejects(IosScreenQuerySchema, { ticket: "t", codec: "vp8" });
    roundTrip(DeviceScreenServerMessageSchema, { type: "meta", deviceName: "iPhone 17 Pro", codec: "h264", width: 1320, height: 2868 });
  });

  test("link messages", () => {
    roundTrip(IosLinkHostMessageSchema, { type: "hello", hostId: "macbook", version: "0.1.0" });
    roundTrip(IosLinkHostMessageSchema, { type: "simulator", available: true, booted: sampleSimDevice });
    roundTrip(IosLinkHostMessageSchema, { type: "tunnels", tunnels: sampleHostIosStatus.tunnels });
    roundTrip(IosLinkHostMessageSchema, { type: "progress", requestId: "r1", stage: "awaiting_confirmation" });
    roundTrip(IosLinkHostMessageSchema, { type: "result", requestId: "r1", ok: true, error: null, bundleId: "com.example.app" });
    roundTrip(IosLinkSandboxMessageSchema, { type: "runs", runs: [{ port: 8081, scheme: "myapp" }, { port: 8082, scheme: null }] });
    roundTrip(IosLinkSandboxMessageSchema, { type: "openUrl", requestId: "r2", url: "exp://127.0.0.1:8081", expoSdkVersion: "54.0.0" });
    roundTrip(IosLinkSandboxMessageSchema, { type: "install", requestId: "r3", artifactId: sampleIosInstall.artifactId });
    rejects(IosLinkSandboxMessageSchema, { type: "runs", runs: [{ port: 8081, scheme: "https" }] });
    rejects(IosLinkSandboxMessageSchema, { type: "runs", runs: [{ port: 80, scheme: null }] });
    rejects(IosLinkSandboxMessageSchema, { type: "openUrl", requestId: "r 2", url: "exp://127.0.0.1:8081" });
  });
});

describe("iosOpenUrlRefusal", () => {
  const runs = [{ port: 8081, scheme: "myapp" }];

  test("allows Expo URLs of an announced port and announced app schemes", () => {
    expect(iosOpenUrlRefusal("exp://127.0.0.1:8081", runs)).toBeNull();
    expect(iosOpenUrlRefusal("exp://127.0.0.1:8081/--/settings", runs)).toBeNull();
    expect(iosOpenUrlRefusal("myapp://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081", runs)).toBeNull();
    expect(isExpoGoUrl("exp://127.0.0.1:8081")).toBe(true);
    expect(isExpoGoUrl("myapp://x")).toBe(false);
  });

  test("refuses everything else", () => {
    expect(iosOpenUrlRefusal("exp://127.0.0.1:8082", runs)).toBe(IOS_URL_REFUSALS.expHost);
    expect(iosOpenUrlRefusal("exp://192.168.1.2:8081", runs)).toBe(IOS_URL_REFUSALS.expHost);
    expect(iosOpenUrlRefusal("exp://user:pw@127.0.0.1:8081", runs)).toBe(IOS_URL_REFUSALS.credentials);
    expect(iosOpenUrlRefusal("https://example.com", [{ port: 8081, scheme: null }])).toBe(IOS_URL_REFUSALS.scheme);
    expect(iosOpenUrlRefusal("otherapp://x", runs)).toBe(IOS_URL_REFUSALS.scheme);
    expect(iosOpenUrlRefusal("not a url", runs)).toBe(IOS_URL_REFUSALS.invalid);
    expect(iosOpenUrlRefusal(`myapp://${"a".repeat(3000)}`, runs)).toBe(IOS_URL_REFUSALS.tooLong);
  });
});

describe("stop signals", () => {
  test("SIGTERM by default, SIGKILL to force", () => {
    expect(STOP_SIGNALS).toEqual(["SIGTERM", "SIGKILL"]);
    expect(DEFAULT_STOP_SIGNAL).toBe("SIGTERM");
    expect(StopSignalQuerySchema.parse({})).toEqual({});
    expect(StopSignalQuerySchema.parse({ signal: "SIGKILL" })).toEqual({ signal: "SIGKILL" });
    rejects(StopSignalQuerySchema, { signal: "SIGHUP" });
  });
});

describe("sandbox side of the ios link", () => {
  test("link requests, installs and the expo-ios run target", () => {
    const request = sampleSandboxIosStatus.requests[0]!;
    roundTrip(IosLinkRequestSchema, request);
    roundTrip(IosLinkRequestSchema, { ...request, type: "install", url: null, artifactId: "art_7h3k9m2p4q", state: "running", stage: "awaiting_confirmation", endedAt: null });
    rejects(IosLinkRequestSchema, { ...request, state: "pending" });
    roundTrip(InstallOnSimulatorSchema, { artifactId: "art_7h3k9m2p4q" });
    rejects(InstallOnSimulatorSchema, { artifactId: "ins_1" });
    rejects(SandboxIosStatusSchema, { ...sampleSandboxIosStatus, runs: undefined });
    roundTrip(AppRunSchema, sampleIosAppRun);
    roundTrip(AppRunSchema, { ...sampleIosAppRun, viewer: { kind: "ios", udid: null } });
    expect(RUN_TARGET_VIEWERS["expo-ios"]).toBe("ios");
    expect(RUN_TARGET_DEFAULT_PORTS["expo-ios"]).toBe(8081);
  });
});
