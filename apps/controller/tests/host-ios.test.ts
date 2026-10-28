import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer, type Server as TcpServer } from "node:net";
import { join } from "node:path";
import {
  ANDROID_H264_FLAGS,
  DEFAULT_IOS_STREAM,
  HostIosStatusSchema,
  HostSessionSchema,
  IOS_URL_REFUSALS,
  IosLinkHostMessageSchema,
  IosStreamSettingsSchema,
  SimDeviceSchema,
  type DeviceScreenServerMessage,
  type IosLinkHostMessage,
  type IosLinkSandboxMessage,
  type IosStreamSettings,
} from "@tesseract/protocol";
import type { ServerWebSocket } from "bun";
import { run, type RunResult } from "../src/core/exec";
import { silentLogger } from "../src/core/logger";
import { parseEmulatorPids } from "../src/host/android/emulator";
import { ffmpegMjpegArgs } from "../src/host/android/scrcpy";
import type { ScreenClient } from "../src/host/android/screen";
import { loadHostConfig, type HostConfig } from "../src/host/config";
import { findApp } from "../src/host/ios/bundle";
import { loadIosConfig, type IosConfig } from "../src/host/ios/config";
import { expoGoUrl } from "../src/host/ios/expo-go";
import { ffmpegJpegArgs, freePort, h264StreamArgs, jpegSize, scaleFor, truncateUtf8, videoStreamArgs } from "../src/host/ios/idb";
import { IosGestures, type IosInput } from "../src/host/ios/input";
import { INSTALL_MESSAGES, IosInstalls } from "../src/host/ios/installs";
import { IosLink, linkSimulatorView } from "../src/host/ios/link";
import type { CommandRunner, ProcessSpawner, SpawnedProcess } from "../src/host/ios/runner";
import type { SandboxApi } from "../src/host/ios/sandbox-api";
import { ENCODER_BACKLOG_BYTES, IdbScreenSession, IOS_SCREEN_MESSAGES, IosScreens, SimcapScreenSession, type IosScreenSession, type IosScreenTarget, type IosSessionEvents } from "../src/host/ios/screen";
import { SIMCAP_FLAGS, SimcapPacketParser, simcapStreamArgs, type IosSessionStream } from "../src/host/ios/simcap";
import { parseIdbDescribe, parseSimctlDevices, parseXcodeVersion, runtimeLabel, Simctl } from "../src/host/ios/simctl";
import { IosSimulators, parseDevicePids, SIMULATOR_MESSAGES } from "../src/host/ios/simulator";
import { startHostShell, type HostShell } from "../src/host/server";
import { HostStateStore } from "../src/host/state";
import { makeTempDir, removeTempDirs, waitFor } from "./helpers";

afterAll(removeTempDirs);

const PHONE = "5A7C3E21-9B0D-4F6A-8E1C-2D3B4A5F6E7D";
const PAD = "0F1E2D3C-4B5A-6978-8796-A5B4C3D2E1F0";
const PIN = "482913";

const config = (overrides: Partial<IosConfig> = {}): IosConfig => ({
  enabled: true,
  platform: "darwin",
  xcrun: "/usr/bin/xcrun",
  idb: "/opt/bin/idb",
  idbCompanion: "/opt/bin/idb_companion",
  ffmpeg: null,
  simcap: null,
  env: { PATH: "/usr/bin:/bin" },
  ...overrides,
});

/** A JPEG with only SOI, a baseline SOF0 of the given size and EOI: enough for the splitter and `jpegSize`. */
function jpeg(width: number, height: number, tag = 0): Buffer {
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, tag];
  return Buffer.from([0xff, 0xd8, ...sof, 0xff, 0xd9]);
}

type Call = { cmd: string[]; env?: Record<string, string | undefined> };
type Reply = Partial<RunResult<string>>;

function fakeRunner(handler: (cmd: string[]) => Reply | undefined | Promise<Reply | undefined>) {
  const calls: Call[] = [];
  const runner: CommandRunner = async (cmd, options) => {
    calls.push({ cmd, env: options?.env });
    const reply = (await handler(cmd)) ?? {};
    const ok = reply.ok ?? true;
    return { ok, code: ok ? 0 : 1, stdout: reply.stdout ?? "", stderr: reply.stderr ?? "", timedOut: reply.timedOut ?? false, error: null };
  };
  return { runner, calls };
}

/** A Mac with two simulators; `simctl` subcommands change their state like CoreSimulator would. */
function fakeMac(options: { xcode?: boolean; bootFails?: boolean; ps?: string } = {}) {
  const states: Record<string, string> = { [PHONE]: "Shutdown", [PAD]: "Shutdown" };
  const opened: string[] = [];
  const installed: string[] = [];
  const apps = new Set<string>();
  const { runner, calls } = fakeRunner((cmd) => {
    const [bin, tool, sub, udid, arg] = cmd;
    if (bin === "ps") return { stdout: options.ps ?? "" };
    if (tool === "xcodebuild") return { stdout: "Xcode 26.0\nBuild version 17A324\n" };
    if (tool !== "simctl") return undefined;
    if (sub === "help") return { ok: options.xcode !== false };
    if (sub === "list") {
      const device = (udid: string, name: string) => ({ udid, name, state: states[udid], isAvailable: true });
      return {
        stdout: JSON.stringify({
          devices: {
            "com.apple.CoreSimulator.SimRuntime.iOS-26-0": [device(PHONE, "iPhone 17 Pro"), device(PAD, "iPad Air 11-inch (M3)")],
            "com.apple.CoreSimulator.SimRuntime.watchOS-11-0": [{ udid: "11111111-2222-3333-4444-555555555555", name: "Watch", state: "Shutdown", isAvailable: true }],
          },
        }),
      };
    }
    if (sub === "boot" && udid) {
      if (options.bootFails) return { ok: false, stderr: "Unable to boot device in current state: Booted" };
      states[udid] = "Booted";
      return {};
    }
    if (sub === "bootstatus") return {};
    if (sub === "shutdown" && udid) {
      states[udid] = "Shutdown";
      return {};
    }
    if (sub === "openurl" && arg) {
      opened.push(arg);
      return {};
    }
    if (sub === "install" && arg) {
      installed.push(arg);
      apps.add("host.exp.Exponent");
      return {};
    }
    if (sub === "get_app_container" && arg) return { ok: apps.has(arg) };
    return undefined;
  });
  return { runner, calls, states, opened, installed, apps };
}

function simulators(mac: ReturnType<typeof fakeMac>, overrides: Partial<IosConfig> = {}) {
  return new IosSimulators(config(overrides), silentLogger, { runner: mac.runner, watchMs: 0 });
}

type Viewer = { client: ScreenClient; messages: DeviceScreenServerMessage[]; frames: Buffer[]; closed: { code: number; reason: string } | null; buffered: number };

function viewer(): Viewer {
  const state: Viewer = {
    messages: [],
    frames: [],
    closed: null,
    buffered: 0,
    client: undefined as never,
  };
  state.client = {
    send: (message) => state.messages.push(message),
    sendFrame: (frame) => state.frames.push(Buffer.from(frame)),
    bufferedAmount: () => state.buffered,
    close: (code, reason) => {
      state.closed = { code, reason };
    },
  };
  return state;
}

function recordingInput() {
  const calls: string[] = [];
  const input: IosInput = {
    tap: async (x, y, duration) => void calls.push(`tap ${Math.round(x)} ${Math.round(y)}${duration ? ` ${duration.toFixed(1)}` : ""}`),
    swipe: async (from, to, duration) => void calls.push(`swipe ${Math.round(from.x)},${Math.round(from.y)} ${Math.round(to.x)},${Math.round(to.y)} ${duration.toFixed(2)}`),
    text: async (text) => void calls.push(`text ${text}`),
    key: async (usage) => void calls.push(`key ${usage}`),
    button: async (name) => void calls.push(`button ${name}`),
  };
  return { input, calls };
}

describe("parsers", () => {
  test("simctl devices, runtimes and Xcode", () => {
    expect(runtimeLabel("com.apple.CoreSimulator.SimRuntime.iOS-26-0")).toBe("iOS 26.0");
    expect(runtimeLabel("com.apple.CoreSimulator.SimRuntime.iOS-18-6-1")).toBe("iOS 18.6.1");
    expect(runtimeLabel("custom")).toBe("custom");
    const devices = parseSimctlDevices(
      JSON.stringify({
        devices: {
          "com.apple.CoreSimulator.SimRuntime.iOS-18-6": [{ udid: PAD, name: "iPad", state: "Shutting Down", isAvailable: true }],
          "com.apple.CoreSimulator.SimRuntime.iOS-26-0": [
            { udid: PHONE, name: "iPhone", state: "Booted", isAvailable: true },
            { udid: "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA", name: "Gone", state: "Shutdown", isAvailable: false },
            { udid: "--set", name: "Bad", state: "Shutdown", isAvailable: true },
          ],
          "com.apple.CoreSimulator.SimRuntime.tvOS-26-0": [{ udid: "BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB", name: "TV", state: "Shutdown" }],
        },
      }),
    );
    expect(devices).toEqual([
      { udid: PHONE, name: "iPhone", runtime: "iOS 26.0", state: "booted" },
      { udid: PAD, name: "iPad", runtime: "iOS 18.6", state: "shutting_down" },
    ]);
    expect(parseSimctlDevices("not json")).toEqual([]);
    expect(parseXcodeVersion("Xcode 26.0\nBuild version 17A324")).toBe("Xcode 26.0");
    expect(parseXcodeVersion("xcode-select: error")).toBeNull();
  });

  test("idb describe, JPEG size and scale", () => {
    expect(parseIdbDescribe(JSON.stringify({ screen_dimensions: { width: 1206, height: 2622, density: 3, width_points: 402, height_points: 874 } }))).toEqual({
      widthPx: 1206,
      heightPx: 2622,
      scale: 3,
      widthPt: 402,
      heightPt: 874,
    });
    expect(parseIdbDescribe(JSON.stringify({ screen_dimensions: { width: 1640, height: 2360, density: 2 } }))?.widthPt).toBe(820);
    expect(parseIdbDescribe("{}")).toBeNull();
    expect(jpegSize(jpeg(603, 1311))).toEqual({ width: 603, height: 1311 });
    expect(jpegSize(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))).toBeNull();
    expect(scaleFor({ widthPx: 1206, heightPx: 2622, widthPt: 402, heightPt: 874, scale: 3 }, 1280)).toBeCloseTo(1280 / 2622);
    expect(scaleFor(null, 1280)).toBe(1);
    expect(videoStreamArgs("/opt/bin/idb", 0.5)).toEqual(["/opt/bin/idb", "video-stream", "--format", "mjpeg", "--fps", "30", "--compression-quality", "0.6", "--scale-factor", "0.500"]);
    expect(h264StreamArgs("/opt/bin/idb")).toEqual(["/opt/bin/idb", "video-stream", "--format", "h264", "--fps", "30"]);
    const decode = ffmpegJpegArgs("/opt/bin/ffmpeg", 0.5);
    expect(decode[0]).toBe("/opt/bin/ffmpeg");
    expect(decode).toContain("fps=15,scale=trunc(iw*0.500/2)*2:-2,mpdecimate=max=15");
    expect(decode.slice(-3)).toEqual(["-q:v", "7", "pipe:1"]);
    expect(ffmpegJpegArgs("/opt/bin/ffmpeg", 1)).toContain("fps=15,mpdecimate=max=15");
    expect(decode).not.toContain("low_delay");
    expect(Buffer.byteLength(truncateUtf8("é".repeat(200)))).toBe(300);
  });

  test("ps lines of a device and of an emulator", () => {
    const ps = [
      `  101 /Library/Developer/PrivateFrameworks/CoreSimulator.framework/Resources/bin/launchd_sim /Users/me/Library/Developer/CoreSimulator/Devices/${PHONE}/data/var/run/launchd_bootstrap.plist`,
      `  102 /opt/homebrew/bin/idb_companion --udid ${PHONE.toLowerCase()} --grpc-port 50051`,
      `  103 /Library/.../launchd_sim /Users/me/Library/Developer/CoreSimulator/Devices/${PAD}/data/var/run/launchd_bootstrap.plist`,
      `  104 vim notes-${PHONE}.txt`,
      "  200 /sdk/emulator/qemu/linux-x86_64/qemu-system-x86_64 -avd Pixel_5 -port 5554 -no-window",
      "  201 /sdk/emulator/emulator -avd Pixel_5 -port 5556",
      "  202 bash -c echo -port 5554",
    ].join("\n");
    expect(parseDevicePids(ps, PHONE)).toEqual([101, 102]);
    expect(parseEmulatorPids(ps, 5554)).toEqual([200]);
    expect(parseEmulatorPids(ps, 5556)).toEqual([201]);
  });

  test("Expo Go build URL and app bundles", () => {
    const index = { data: { iosUrl: "https://dpq5q02fu5f55.cloudfront.net/Exponent-2.33.0.tar.gz", sdkVersions: { "53.0.0": { iosClientUrl: "https://example.expo.dev/Exponent-2.32.tar.gz" } } } };
    expect(expoGoUrl(index, "53.0.0")).toBe("https://example.expo.dev/Exponent-2.32.tar.gz");
    expect(expoGoUrl(index, "54.0.0")).toBe(index.data.iosUrl);
    expect(expoGoUrl({}, undefined)).toBeNull();
    const dir = makeTempDir("ios-bundle");
    mkdirSync(join(dir, "build", "Payload", "My App.app"), { recursive: true });
    writeFileSync(join(dir, "build", "Payload", "My App.app", "Info.plist"), "<plist/>");
    expect(findApp(dir)).toBe(join(dir, "build", "Payload", "My App.app"));
    mkdirSync(join(dir, "Expo Go.app"));
    writeFileSync(join(dir, "Expo Go.app", "Info.plist"), "<plist/>");
    expect(findApp(join(dir, "Expo Go.app"))).toBe(join(dir, "Expo Go.app"));
    expect(findApp(join(dir, "missing"))).toBeNull();
  });
});

describe("loadIosConfig", () => {
  test("off unless TESSERACT_IOS is on; tools from the overrides", () => {
    expect(loadIosConfig({ PATH: "" }, "darwin", () => false).enabled).toBe(false);
    const dir = makeTempDir("ios-config");
    const idb = join(dir, "idb");
    writeFileSync(idb, "");
    const loaded = loadIosConfig({ PATH: "", TESSERACT_IOS: "1", TESSERACT_IDB: idb, TESSERACT_IDB_COMPANION: join(dir, "missing"), TESSERACT_HOST_SHELL_PORT: "1" }, "darwin");
    expect(loaded).toMatchObject({ enabled: true, platform: "darwin", idb, idbCompanion: null });
    expect(loaded.env.TESSERACT_HOST_SHELL_PORT).toBeUndefined();
    expect(loaded.env.PATH).toContain("/opt/homebrew/bin");
    expect(() => loadIosConfig({ TESSERACT_IOS: "maybe" }, "darwin")).toThrow("TESSERACT_IOS must be on or off");
  });

  test("tesseract-simcap: TESSERACT_SIMCAP, else PATH or ~/.tesseract/bin, never off macOS", () => {
    const dir = makeTempDir("ios-simcap");
    const simcap = join(dir, "tesseract-simcap");
    writeFileSync(simcap, "#!/bin/sh\n", { mode: 0o755 });
    expect(loadIosConfig({ PATH: "", TESSERACT_SIMCAP: simcap }, "darwin").simcap).toBe(simcap);
    expect(loadIosConfig({ PATH: "", TESSERACT_SIMCAP: join(dir, "missing") }, "darwin").simcap).toBeNull();
    expect(loadIosConfig({ PATH: dir, HOME: join(dir, "home") }, "darwin").simcap).toBe(simcap);
    const home = makeTempDir("ios-simcap-home");
    mkdirSync(join(home, ".tesseract", "bin"), { recursive: true });
    writeFileSync(join(home, ".tesseract", "bin", "tesseract-simcap"), "#!/bin/sh\n", { mode: 0o755 });
    expect(loadIosConfig({ PATH: "", HOME: home }, "darwin").simcap).toBe(join(home, ".tesseract", "bin", "tesseract-simcap"));
    expect(loadIosConfig({ PATH: dir, TESSERACT_SIMCAP: simcap }, "linux").simcap).toBeNull();
  });
});

describe("IosSimulators", () => {
  test("availability codes: disabled, not macOS, no Xcode, no idb", async () => {
    const mac = fakeMac();
    expect(await simulators(mac, { enabled: false }).availability()).toMatchObject({ available: false, reasonCode: "disabled", reason: SIMULATOR_MESSAGES.disabled });
    expect((await simulators(mac, { platform: "linux" }).availability()).reasonCode).toBe("not_macos");
    expect((await simulators(fakeMac({ xcode: false })).availability()).reasonCode).toBe("no_xcode");
    expect(await simulators(mac, { idbCompanion: null }).availability()).toMatchObject({ reasonCode: "no_idb", xcode: "Xcode 26.0" });
    expect(await simulators(mac).availability()).toEqual({ available: true, reasonCode: null, reason: null, xcode: "Xcode 26.0" });
    expect(await simulators(mac, { enabled: false }).list()).toEqual([]);
  });

  test("boots with bootstatus, refuses a second boot, shuts down", async () => {
    const mac = fakeMac();
    const sims = simulators(mac);
    const changes: (string | null)[] = [];
    sims.onChange((booted) => changes.push(booted ? `${booted.name}:${booted.state}` : null));
    const booting = await sims.boot(PHONE);
    expect(SimDeviceSchema.parse(booting)).toMatchObject({ udid: PHONE, state: "booting", runtime: "iOS 26.0" });
    await waitFor(async () => (await sims.target())?.udid === PHONE);
    expect(mac.calls.map((call) => call.cmd.slice(1, 3).join(" "))).toContain("simctl bootstatus");
    await expect(sims.boot(PHONE)).rejects.toMatchObject({ status: 409 });
    await expect(sims.boot("AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA")).rejects.toMatchObject({ status: 404 });
    expect(changes).toContain("iPhone 17 Pro:booted");

    const stopping = await sims.shutdown();
    expect(stopping.state).toBe("shutting_down");
    await waitFor(async () => (await sims.target()) === null);
    await expect(sims.shutdown()).rejects.toMatchObject({ status: 409 });
    expect(mac.calls.some((call) => call.cmd[0] === "ps")).toBe(false);
  });

  test("a failed boot marks the device failed; it can be booted again", async () => {
    const mac = fakeMac({ bootFails: true });
    const sims = simulators(mac);
    await sims.boot(PAD);
    const failed = await waitFor(async () => (await sims.list()).find((device) => device.udid === PAD && device.state === "failed"));
    expect(failed.error).toContain("simctl boot failed");
    expect((await sims.boot(PAD)).state).toBe("booting");
  });

  test("SIGKILL kills the device's processes before simctl shutdown", async () => {
    const victim = Bun.spawn(["sleep", "30"]);
    const mac = fakeMac({ ps: `${victim.pid} /x/launchd_sim /Devices/${PHONE}/data/var/run/launchd_bootstrap.plist\n${process.pid} idb_companion --udid ${PHONE}` });
    mac.states[PHONE] = "Booted";
    const sims = simulators(mac);
    const ended: string[] = [];
    await sims.shutdown("SIGKILL", async (udid, kill) => void ended.push(`${udid}:${kill}`));
    await victim.exited;
    expect(victim.signalCode).toBe("SIGKILL");
    await waitFor(() => mac.states[PHONE] === "Shutdown");
    expect(ended).toEqual([`${PHONE}:true`]);
    const order = mac.calls.map((call) => (call.cmd[0] === "ps" ? "ps" : call.cmd.slice(1, 3).join(" ")));
    expect(order.indexOf("ps")).toBeLessThan(order.indexOf("simctl shutdown"));
  });
});

describe("IosGestures", () => {
  const points = { width: 400, height: 800 };
  const at = (x: number, y: number) => ({ x, y, width: 800, height: 1600 });

  test("down/up is a tap, a held touch a long press, a drag a swipe", async () => {
    let now = 0;
    const { input, calls } = recordingInput();
    const gestures = new IosGestures(input, () => points, { now: () => now });
    const owner = {};
    gestures.handle(owner, { type: "touch", action: "down", pointerId: 0, ...at(200, 400), pressure: 1 });
    now = 80;
    gestures.handle(owner, { type: "touch", action: "up", pointerId: 0, ...at(204, 402), pressure: 0 });
    gestures.handle(owner, { type: "touch", action: "down", pointerId: 0, ...at(200, 400), pressure: 1 });
    now = 900;
    gestures.handle(owner, { type: "touch", action: "up", pointerId: 0, ...at(200, 400), pressure: 0 });
    gestures.handle(owner, { type: "touch", action: "down", pointerId: 0, ...at(400, 1400), pressure: 1 });
    gestures.handle(owner, { type: "touch", action: "move", pointerId: 0, ...at(400, 900), pressure: 1 });
    now = 1200;
    gestures.handle(owner, { type: "touch", action: "up", pointerId: 0, ...at(400, 400), pressure: 0 });
    await gestures.idle();
    expect(calls).toEqual(["tap 100 200", "tap 100 200 0.8", "swipe 200,700 200,200 0.30"]);
  });

  test("one pointer per device: other pointers and other viewers are dropped; cancel and release drop the gesture", async () => {
    const { input, calls } = recordingInput();
    const gestures = new IosGestures(input, () => points);
    const a = {};
    const b = {};
    gestures.handle(a, { type: "touch", action: "down", pointerId: 0, ...at(100, 100), pressure: 1 });
    gestures.handle(a, { type: "touch", action: "down", pointerId: 1, ...at(300, 300), pressure: 1 });
    gestures.handle(b, { type: "touch", action: "down", pointerId: 0, ...at(500, 500), pressure: 1 });
    gestures.handle(b, { type: "touch", action: "up", pointerId: 0, ...at(500, 500), pressure: 0 });
    gestures.handle(a, { type: "touch", action: "up", pointerId: 1, ...at(300, 300), pressure: 0 });
    gestures.handle(a, { type: "touch", action: "cancel", pointerId: 0, ...at(100, 100), pressure: 0 });
    gestures.handle(b, { type: "touch", action: "down", pointerId: 0, ...at(500, 500), pressure: 1 });
    gestures.release(b);
    gestures.handle(b, { type: "touch", action: "up", pointerId: 0, ...at(500, 500), pressure: 0 });
    await gestures.idle();
    expect(calls).toEqual([]);
  });

  test("keys, buttons, text and coalesced scroll", async () => {
    const { input, calls } = recordingInput();
    const gestures = new IosGestures(input, () => points, { scrollWindowMs: 20 });
    for (const key of ["home", "power", "enter", "del", "back", "app_switch", "volume_up", "up"] as const) gestures.handle({}, { type: "key", key });
    gestures.handle({}, { type: "text", text: "héllo" });
    gestures.handle({}, { type: "rotate" });
    gestures.handle({}, { type: "scroll", ...at(400, 800), hscroll: 0, vscroll: -1 });
    gestures.handle({}, { type: "scroll", ...at(400, 800), hscroll: 0, vscroll: -2 });
    await Bun.sleep(60);
    await gestures.idle();
    expect(calls).toEqual(["button HOME", "button LOCK", "key 40", "key 42", "key 82", "text héllo", "swipe 200,400 200,280 0.15"]);
  });
});

type FakeSession = IosScreenSession & { events: IosSessionEvents; started: boolean; stopped: boolean; keyRequests: number; target: IosScreenTarget };

function screens(target: () => Promise<{ udid: string; name: string } | null>, reason: string | null = null, settings?: () => IosStreamSettings) {
  const sessions: FakeSession[] = [];
  const input = recordingInput();
  const manager = new IosScreens(config(), { target, unavailableReason: async () => reason }, silentLogger, {
    settings,
    factory: (target, events) => {
      const session: FakeSession = {
        events,
        target,
        started: false,
        stopped: false,
        keyRequests: 0,
        requestKeyFrame: () => {
          session.keyRequests++;
        },
        start: async () => {
          session.started = true;
        },
        stop: async () => {
          session.stopped = true;
        },
        input: () => input.input,
        points: () => ({ width: 402, height: 874 }),
      };
      sessions.push(session);
      return session;
    },
  });
  return { manager, sessions, input };
}

describe("IosScreens", () => {
  const phone = async () => ({ udid: PHONE, name: "iPhone 17 Pro" });

  test("shared session: meta on the first frame, late viewer gets meta and the last JPEG, ends with the last viewer", async () => {
    const { manager, sessions } = screens(phone);
    const first = viewer();
    const detachFirst = manager.attach(first.client, { maxSize: 640 });
    await waitFor(() => sessions.length === 1);
    expect(sessions[0]?.target.maxSize).toBe(640);
    sessions[0]?.events.frame(jpeg(603, 1311, 1));
    expect(first.messages).toEqual([{ type: "meta", deviceName: "iPhone 17 Pro", codec: "mjpeg", width: 603, height: 1311 }]);
    expect(first.frames).toHaveLength(1);

    const late = viewer();
    const detachLate = manager.attach(late.client, { maxSize: 640 });
    await waitFor(() => late.frames.length === 1);
    expect(sessions).toHaveLength(1);
    expect(late.messages[0]).toMatchObject({ type: "meta", width: 603 });

    first.buffered = 10 * 1024 * 1024;
    sessions[0]?.events.frame(jpeg(1311, 603, 2));
    expect(first.frames).toHaveLength(1);
    expect(late.frames).toHaveLength(2);
    expect(late.messages.at(-1)).toEqual({ type: "size", width: 1311, height: 603 });

    detachFirst();
    expect(sessions[0]?.stopped).toBe(false);
    detachLate();
    await waitFor(() => sessions[0]?.stopped);
    expect(manager.viewers).toBe(0);
  });

  test("a viewer of another size gets its own session; the device keeps one pointer across sessions", async () => {
    const { manager, sessions, input } = screens(phone);
    const phoneViewer = viewer();
    const panel = viewer();
    manager.attach(phoneViewer.client, { maxSize: 640 });
    await waitFor(() => sessions.length === 1);
    manager.attach(panel.client, { maxSize: 1600, codec: "h264" });
    await waitFor(() => sessions.length === 2);
    expect(sessions.map((session) => session.target.maxSize)).toEqual([640, 1600]);
    sessions[0]?.events.frame(jpeg(294, 640));

    const at = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
    manager.handle(panel.client, { type: "touch", action: "down", pointerId: 0, ...at(368, 800, 736, 1600), pressure: 1 });
    manager.handle(phoneViewer.client, { type: "touch", action: "down", pointerId: 0, ...at(147, 320, 294, 640), pressure: 1 });
    manager.handle(phoneViewer.client, { type: "touch", action: "up", pointerId: 0, ...at(147, 320, 294, 640), pressure: 0 });
    manager.handle(panel.client, { type: "touch", action: "up", pointerId: 0, ...at(368, 800, 736, 1600), pressure: 0 });
    await waitFor(() => input.calls.length === 1);
    await Bun.sleep(30);
    expect(input.calls).toEqual(["tap 201 437"]);

    // The panel's session ends; the pointer it held is released for the other viewer.
    manager.handle(panel.client, { type: "touch", action: "down", pointerId: 0, ...at(368, 800, 736, 1600), pressure: 1 });
    sessions[1]?.events.failed("tesseract-simcap exited (code 1)");
    manager.handle(phoneViewer.client, { type: "touch", action: "down", pointerId: 0, ...at(147, 320, 294, 640), pressure: 1 });
    manager.handle(phoneViewer.client, { type: "touch", action: "up", pointerId: 0, ...at(147, 320, 294, 640), pressure: 0 });
    await waitFor(() => input.calls.length === 2);
    expect(sessions[0]?.stopped).toBe(false);
  });

  test("touches go through the session's input in device points", async () => {
    const { manager, sessions, input } = screens(phone);
    const one = viewer();
    manager.attach(one.client);
    await waitFor(() => sessions.length === 1);
    sessions[0]?.events.frame(jpeg(804, 1748));
    manager.handle(one.client, { type: "touch", action: "down", pointerId: 0, x: 402, y: 874, width: 804, height: 1748, pressure: 1 });
    manager.handle(one.client, { type: "touch", action: "up", pointerId: 0, x: 402, y: 874, width: 804, height: 1748, pressure: 0 });
    await waitFor(() => input.calls.length === 1);
    expect(input.calls).toEqual(["tap 201 437"]);
  });

  test("errors: unavailable, nothing booted, a failing session, the device shutting down", async () => {
    const off = viewer();
    screens(phone, "iOS Simulator support is off").manager.attach(off.client);
    await waitFor(() => off.closed);
    expect(off.messages).toEqual([{ type: "error", message: "iOS Simulator support is off" }]);

    const none = viewer();
    screens(async () => null).manager.attach(none.client);
    await waitFor(() => none.closed);
    expect(none.messages).toEqual([{ type: "error", message: IOS_SCREEN_MESSAGES.notBooted }]);

    const { manager, sessions } = screens(phone);
    const failing = viewer();
    manager.attach(failing.client);
    await waitFor(() => sessions.length === 1);
    sessions[0]?.events.failed("idb video-stream exited (code 1)");
    expect(failing.messages).toEqual([{ type: "error", message: "idb video-stream exited (code 1)" }]);
    expect(failing.closed?.code).toBe(1011);

    const watching = viewer();
    manager.attach(watching.client);
    await waitFor(() => sessions.length === 2);
    await manager.end(PHONE);
    expect(watching.messages).toEqual([{ type: "error", message: IOS_SCREEN_MESSAGES.shutdown }]);
    expect(sessions[1]?.stopped).toBe(true);
  });
});

/** One `tesseract-simcap stream` packet: u32 BE length, flags, payload. */
function simcapPacket(flags: number, payload: Buffer): Buffer {
  const header = Buffer.alloc(5);
  header.writeUInt32BE(payload.length, 0);
  header[4] = flags;
  return Buffer.concat([header, payload]);
}

function simcapSize(width: number, height: number): Buffer {
  const payload = Buffer.alloc(8);
  payload.writeUInt32BE(width, 0);
  payload.writeUInt32BE(height, 4);
  return simcapPacket(SIMCAP_FLAGS.size, payload);
}

const SPS_PPS = Buffer.from([0, 0, 0, 1, 0x67, 0x42, 0, 0x1f, 0, 0, 0, 1, 0x68, 0xce]);
const idr = (tag: number) => Buffer.from([0, 0, 0, 1, 0x65, tag]);
const delta = (tag: number) => Buffer.from([0, 0, 0, 1, 0x41, tag]);
const h264 = (flags: number, data: Buffer) => Buffer.concat([Buffer.of(flags), data]);

describe("SimcapPacketParser", () => {
  test("size, config, key and delta packets, split anywhere across chunks", () => {
    const stream = Buffer.concat([
      simcapSize(590, 1280),
      simcapPacket(SIMCAP_FLAGS.config, SPS_PPS),
      simcapPacket(SIMCAP_FLAGS.keyFrame, idr(1)),
      simcapPacket(0, delta(2)),
    ]);
    for (const step of [1, 3, 7, stream.length]) {
      const parser = new SimcapPacketParser();
      const packets = [];
      for (let offset = 0; offset < stream.length; offset += step) packets.push(...parser.push(stream.subarray(offset, offset + step)));
      expect(packets).toEqual([
        { type: "size", width: 590, height: 1280 },
        { type: "frame", data: SPS_PPS, config: true, keyFrame: false },
        { type: "frame", data: idr(1), config: false, keyFrame: true },
        { type: "frame", data: delta(2), config: false, keyFrame: false },
      ]);
    }
    const header = Buffer.alloc(5);
    header.writeUInt32BE(64 * 1024 * 1024, 0);
    expect(() => new SimcapPacketParser().push(header)).toThrow("tesseract-simcap sent a");
  });

  test("stream arguments carry the session's settings", () => {
    const stream: IosSessionStream = { codec: "h264", maxSize: 1280, bitRate: 4_000_000, maxFps: 30, keyFrameInterval: 1, jpegQuality: 7 };
    expect(simcapStreamArgs("/opt/bin/simcap", PHONE, stream)).toEqual([
      "/opt/bin/simcap",
      "stream",
      ...["--udid", PHONE, "--bitrate", "4000000", "--fps", "30", "--keyint-sec", "1", "--max-side", "1280"],
    ]);
  });
});

describe("IosScreens H.264", () => {
  const phone = async () => ({ udid: PHONE, name: "iPhone 17 Pro" });
  const SIZE = { width: 590, height: 1280 };
  const configMessage = h264(ANDROID_H264_FLAGS.config, SPS_PPS);

  test("meta with the first key frame, config + GOP for a late viewer, mjpeg viewers get their own session", async () => {
    const { manager, sessions } = screens(phone);
    const first = viewer();
    manager.attach(first.client, { maxSize: 1280, codec: "h264" });
    await waitFor(() => sessions.length === 1);
    const session = sessions[0] as FakeSession;
    const { bitRate, maxFps, keyFrameInterval, jpegQuality } = DEFAULT_IOS_STREAM;
    expect(session.target.stream).toEqual({ codec: "h264", maxSize: 1280, bitRate, maxFps, keyFrameInterval, jpegQuality });
    session.events.size?.(SIZE);
    session.events.video?.({ data: SPS_PPS, config: true, keyFrame: false });
    expect(first.messages).toEqual([]);
    session.events.video?.({ data: idr(1), config: false, keyFrame: true });
    expect(first.messages).toEqual([{ type: "meta", deviceName: "iPhone 17 Pro", codec: "h264", ...SIZE }]);
    session.events.video?.({ data: delta(2), config: false, keyFrame: false });
    expect(first.frames).toEqual([configMessage, h264(ANDROID_H264_FLAGS.keyFrame, idr(1)), h264(0, delta(2))]);

    const late = viewer();
    manager.attach(late.client, { maxSize: 1280, codec: "h264" });
    await waitFor(() => late.frames.length === 3);
    expect(sessions).toHaveLength(1);
    expect(late.messages).toEqual([{ type: "meta", deviceName: "iPhone 17 Pro", codec: "h264", ...SIZE }]);
    expect(late.frames).toEqual(first.frames);
    expect(session.keyRequests).toBe(0);

    const jpegViewer = viewer();
    manager.attach(jpegViewer.client, { maxSize: 1280 });
    await waitFor(() => sessions.length === 2);
    expect(sessions[1]?.target.stream?.codec).toBe("mjpeg");

    session.events.size?.({ width: 1280, height: 590 });
    expect(first.messages.at(-1)).toEqual({ type: "size", width: 1280, height: 590 });
  });

  test("a congested viewer skips to the next key frame and asks for one once it drained", async () => {
    const { manager, sessions } = screens(phone);
    const slow = viewer();
    const fast = viewer();
    manager.attach(slow.client, { codec: "h264" });
    manager.attach(fast.client, { codec: "h264" });
    await waitFor(() => sessions.length === 1 && manager.viewers === 2);
    const session = sessions[0] as FakeSession;
    session.events.size?.(SIZE);
    session.events.video?.({ data: SPS_PPS, config: true, keyFrame: false });
    session.events.video?.({ data: idr(1), config: false, keyFrame: true });
    expect(slow.frames).toHaveLength(2);

    slow.buffered = 1024 * 1024;
    session.events.video?.({ data: delta(2), config: false, keyFrame: false });
    expect(slow.frames).toHaveLength(2);
    expect(fast.frames).toHaveLength(3);
    expect(session.keyRequests).toBe(0);

    slow.buffered = 0;
    session.events.video?.({ data: delta(3), config: false, keyFrame: false });
    session.events.video?.({ data: delta(4), config: false, keyFrame: false });
    expect(slow.frames).toHaveLength(2);
    expect(session.keyRequests).toBe(1);

    session.events.video?.({ data: idr(5), config: false, keyFrame: true });
    expect(slow.frames.slice(2)).toEqual([configMessage, h264(ANDROID_H264_FLAGS.keyFrame, idr(5))]);
    expect(fast.frames.at(-1)).toEqual(h264(ANDROID_H264_FLAGS.keyFrame, idr(5)));
  });

  test("a viewer joining after the GOP was dropped asks for a key frame", async () => {
    const { manager, sessions } = screens(phone);
    const first = viewer();
    manager.attach(first.client, { codec: "h264" });
    await waitFor(() => sessions.length === 1);
    const session = sessions[0] as FakeSession;
    session.events.size?.(SIZE);
    session.events.video?.({ data: SPS_PPS, config: true, keyFrame: false });
    session.events.video?.({ data: idr(1), config: false, keyFrame: true });
    session.events.video?.({ data: Buffer.alloc(9 * 1024 * 1024), config: false, keyFrame: false });
    const late = viewer();
    manager.attach(late.client, { codec: "h264" });
    await waitFor(() => manager.viewers === 2);
    expect(late.messages[0]).toMatchObject({ type: "meta", codec: "h264" });
    expect(late.frames).toEqual([]);
    expect(session.keyRequests).toBe(1);
  });

  test("a session that falls back to JPEGs announces mjpeg", async () => {
    const { manager, sessions } = screens(phone);
    const one = viewer();
    manager.attach(one.client, { codec: "h264" });
    await waitFor(() => sessions.length === 1);
    sessions[0]?.events.fallback?.("tesseract-simcap is not installed on the host");
    sessions[0]?.events.frame(jpeg(603, 1311));
    expect(one.messages).toEqual([{ type: "meta", deviceName: "iPhone 17 Pro", codec: "mjpeg", width: 603, height: 1311 }]);
    expect(one.frames).toHaveLength(1);
  });

  test("restart moves viewers whose session the new settings change", async () => {
    let settings: IosStreamSettings = { ...DEFAULT_IOS_STREAM };
    const { manager, sessions } = screens(phone, null, () => settings);
    const one = viewer();
    manager.attach(one.client, { codec: "h264", maxSize: 900 });
    await waitFor(() => sessions.length === 1);
    manager.restart();
    expect(sessions).toHaveLength(1);

    settings = { ...settings, encoding: "mjpeg", jpegQuality: 4 };
    manager.restart();
    await waitFor(() => sessions.length === 2);
    expect(sessions[0]?.stopped).toBe(true);
    expect(sessions[1]?.target.stream).toMatchObject({ codec: "mjpeg", maxSize: 900, jpegQuality: 4 });
    expect(one.closed).toBeNull();
    sessions[1]?.events.frame(jpeg(414, 900));
    expect(one.messages.at(-1)).toMatchObject({ type: "meta", codec: "mjpeg" });
    expect(manager.viewers).toBe(1);
  });
});

function controllableStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) });
  return { stream, push: (chunk: Uint8Array) => controller.enqueue(chunk), end: () => controller.close() };
}

describe("IdbScreenSession", () => {
  test("starts idb_companion, describes the screen, streams split JPEGs and injects through IDB_COMPANION", async () => {
    const spawned: string[][] = [];
    const servers: TcpServer[] = [];
    const video = controllableStream();
    let companionExit!: (code: number | null) => void;
    const spawner: ProcessSpawner = (cmd) => {
      spawned.push(cmd);
      const empty = new ReadableStream<Uint8Array>({ start: (c) => c.close() });
      if (cmd[0] === "/opt/bin/idb_companion") {
        const port = Number(cmd[cmd.indexOf("--grpc-port") + 1]);
        const server = createServer((socket) => socket.destroy()).listen(port, "127.0.0.1");
        servers.push(server);
        const exited = new Promise<number | null>((resolve) => (companionExit = resolve));
        return { pid: 1, stdout: empty, stderr: empty, exited, stop: async () => companionExit(0) } satisfies SpawnedProcess;
      }
      let videoExit!: (code: number | null) => void;
      const exited = new Promise<number | null>((resolve) => (videoExit = resolve));
      return { pid: 2, stdout: video.stream, stderr: empty, exited, stop: async () => videoExit(null) } satisfies SpawnedProcess;
    };
    const { runner, calls } = fakeRunner((cmd) =>
      cmd[1] === "describe" ? { stdout: JSON.stringify({ screen_dimensions: { width: 1206, height: 2622, density: 3, width_points: 402, height_points: 874 } }) } : {},
    );
    const frames: Buffer[] = [];
    const failures: string[] = [];
    const session = new IdbScreenSession(config(), { udid: PHONE, name: "iPhone", maxSize: 1311 }, { frame: (data) => frames.push(data), failed: (message) => failures.push(message) }, runner, spawner);
    await session.start();
    expect(spawned[0]?.slice(0, 3)).toEqual(["/opt/bin/idb_companion", "--udid", PHONE]);
    expect(spawned[1]).toEqual(videoStreamArgs("/opt/bin/idb", 0.5));
    const port = Number(spawned[0]?.[4]);
    expect(calls[0]?.env?.IDB_COMPANION).toBe(`127.0.0.1:${port}`);

    const a = jpeg(603, 1311, 1);
    const b = jpeg(603, 1311, 2);
    const both = Buffer.concat([a, b]);
    video.push(both.subarray(0, 10));
    video.push(both.subarray(10));
    await waitFor(() => frames.length === 2);
    expect(frames[1]).toEqual(b);
    expect(session.points({ width: 603, height: 1311 })).toEqual({ width: 402, height: 874 });
    expect(session.points({ width: 1311, height: 603 })).toEqual({ width: 874, height: 402 });
    expect(session.geometry()?.scale).toBe(3);

    await session.input()?.tap(10, 20);
    await session.input()?.swipe({ x: 1, y: 2 }, { x: 3, y: 4 }, 0.3);
    await session.input()?.button("HOME");
    expect(calls.slice(1).map((call) => call.cmd.slice(1).join(" "))).toEqual(["ui tap 10 20", "ui swipe 1 2 3 4 --duration 0.30", "ui button HOME"]);

    companionExit(9);
    await waitFor(() => failures.length === 1);
    expect(failures[0]).toContain("idb_companion exited (code 9)");
    await session.stop(0);
    for (const server of servers) server.close();
  });

  test("with ffmpeg, pipes idb's full-size H.264 into ffmpeg and splits its JPEGs", async () => {
    const spawned: { cmd: string[]; stdin?: ReadableStream<Uint8Array> | "pipe" }[] = [];
    const servers: TcpServer[] = [];
    const h264 = controllableStream();
    const decoded = controllableStream();
    const spawner: ProcessSpawner = (cmd, options = {}) => {
      spawned.push({ cmd, stdin: options.stdin });
      const empty = new ReadableStream<Uint8Array>({ start: (c) => c.close() });
      if (cmd[0] === "/opt/bin/idb_companion") {
        const port = Number(cmd[cmd.indexOf("--grpc-port") + 1]);
        servers.push(createServer((socket) => socket.destroy()).listen(port, "127.0.0.1"));
      }
      const stdout = cmd[0] === "/opt/bin/idb" ? h264.stream : cmd[0] === "/opt/bin/ffmpeg" ? decoded.stream : empty;
      return { pid: spawned.length, stdout, stderr: empty, exited: new Promise<number | null>(() => {}), stop: async () => {} } satisfies SpawnedProcess;
    };
    const { runner } = fakeRunner((cmd) =>
      cmd[1] === "describe" ? { stdout: JSON.stringify({ screen_dimensions: { width: 1206, height: 2622, density: 3, width_points: 402, height_points: 874 } }) } : {},
    );
    const frames: Buffer[] = [];
    const session = new IdbScreenSession(config({ ffmpeg: "/opt/bin/ffmpeg" }), { udid: PHONE, name: "iPhone", maxSize: 1311 }, { frame: (data) => frames.push(data), failed: () => {} }, runner, spawner);
    await session.start();
    expect(spawned[1]?.cmd).toEqual(h264StreamArgs("/opt/bin/idb"));
    expect(spawned[2]?.cmd).toEqual(ffmpegJpegArgs("/opt/bin/ffmpeg", 0.5));
    expect(spawned[2]?.stdin).toBe(h264.stream);

    const frame = jpeg(603, 1311, 1);
    decoded.push(frame);
    await waitFor(() => frames.length === 1);
    expect(frames[0]).toEqual(frame);
    await session.stop(0);
    for (const server of servers) server.close();
  });

  test("a companion that never listens fails the start", async () => {
    const spawner: ProcessSpawner = () => {
      const empty = new ReadableStream<Uint8Array>({ start: (c) => c.close() });
      return { pid: 1, stdout: empty, stderr: empty, exited: Promise.resolve(3), stop: async () => {} };
    };
    const session = new IdbScreenSession(config(), { udid: PHONE, name: "iPhone", maxSize: 1280 }, { frame: () => {}, failed: () => {} }, fakeRunner(() => ({})).runner, spawner);
    await expect(session.start()).rejects.toThrow("idb_companion exited");
  });
});

describe("SimcapScreenSession", () => {
  const SIMCAP = "/opt/bin/simcap";
  const FFMPEG = "/opt/bin/ffmpeg";
  const H264_STREAM: IosSessionStream = { codec: "h264", maxSize: 1280, bitRate: 6_000_000, maxFps: 60, keyFrameInterval: 2, jpegQuality: 7 };
  const describeReply = { stdout: JSON.stringify({ screen_dimensions: { width: 1206, height: 2622, density: 3, width_points: 402, height_points: 874 } }) };

  /** idb_companion on a real loopback port; simcap, ffmpeg and idb with controllable output, exit and recorded stdin. */
  function tools() {
    const spawned: string[][] = [];
    const servers: TcpServer[] = [];
    const outputs = { [SIMCAP]: controllableStream(), [FFMPEG]: controllableStream(), "/opt/bin/idb": controllableStream() };
    const writes: Record<string, Buffer[]> = {};
    const exits: Record<string, (code: number | null) => void> = {};
    /** Unread stdin bytes each binary reports, and every binary `stop` was called on. */
    const backlog: Record<string, number> = {};
    const stops: string[] = [];
    const spawner: ProcessSpawner = (cmd) => {
      spawned.push(cmd);
      const bin = cmd[0] ?? "";
      const empty = new ReadableStream<Uint8Array>({ start: (c) => c.close() });
      if (bin === "/opt/bin/idb_companion") {
        const port = Number(cmd[cmd.indexOf("--grpc-port") + 1]);
        servers.push(createServer((socket) => socket.destroy()).listen(port, "127.0.0.1"));
      }
      const exited = new Promise<number | null>((resolve) => (exits[bin] = resolve));
      const stdout = outputs[bin as keyof typeof outputs]?.stream ?? empty;
      const stdin = { write: (data: string | Uint8Array) => void (writes[bin] ??= []).push(Buffer.from(data)), end: () => {}, pending: () => backlog[bin] ?? 0 };
      const stop = async () => {
        stops.push(bin);
        exits[bin]?.(null);
      };
      return { pid: spawned.length, stdout, stderr: empty, exited, stdin, stop } satisfies SpawnedProcess;
    };
    const close = () => {
      for (const server of servers) server.close();
    };
    return { spawner, spawned, outputs, writes, exits, backlog, stops, close };
  }

  function recorder() {
    const events = { jpegs: [] as Buffer[], video: [] as unknown[], sizes: [] as unknown[], failures: [] as string[], fallbacks: [] as string[] };
    const handlers: IosSessionEvents = {
      frame: (data) => events.jpegs.push(data),
      video: (frame) => events.video.push(frame),
      size: (size) => events.sizes.push(size),
      failed: (message) => events.failures.push(message),
      fallback: (reason) => events.fallbacks.push(reason),
    };
    return { events, handlers };
  }

  test("h264: probes, passes packets through, asks for key frames on stdin and fails after the first frame", async () => {
    const fake = tools();
    const { runner, calls } = fakeRunner((cmd) => (cmd[1] === "describe" ? describeReply : {}));
    const { events, handlers } = recorder();
    const session = new SimcapScreenSession(config({ simcap: SIMCAP }), { udid: PHONE, name: "iPhone", maxSize: 1280, stream: H264_STREAM }, handlers, runner, fake.spawner);
    await session.start();
    expect(calls.map((call) => call.cmd.slice(0, 2))).toContainEqual([SIMCAP, "probe"]);
    expect(fake.spawned.at(-1)).toEqual(simcapStreamArgs(SIMCAP, PHONE, H264_STREAM));

    const stream = Buffer.concat([simcapSize(590, 1280), simcapPacket(SIMCAP_FLAGS.config, SPS_PPS), simcapPacket(SIMCAP_FLAGS.keyFrame, idr(1))]);
    fake.outputs[SIMCAP].push(stream.subarray(0, 9));
    fake.outputs[SIMCAP].push(stream.subarray(9));
    await waitFor(() => events.video.length === 2);
    expect(events.sizes).toEqual([{ width: 590, height: 1280 }]);
    expect(events.video).toEqual([
      { data: SPS_PPS, config: true, keyFrame: false },
      { data: idr(1), config: false, keyFrame: true },
    ]);
    session.requestKeyFrame();
    expect(fake.writes[SIMCAP]?.map(String)).toEqual(["k\n"]);
    expect(session.points({ width: 590, height: 1280 })).toEqual({ width: 402, height: 874 });

    fake.outputs[SIMCAP].end();
    fake.exits[SIMCAP]?.(1);
    await waitFor(() => events.failures.length === 1);
    expect(events.failures[0]).toContain("tesseract-simcap exited (code 1)");
    expect(events.fallbacks).toEqual([]);
    await session.stop(0);
    fake.close();
  });

  test("mjpeg: the Annex B payloads go into ffmpeg, its JPEGs come out", async () => {
    const fake = tools();
    const { runner } = fakeRunner((cmd) => (cmd[1] === "describe" ? describeReply : {}));
    const { events, handlers } = recorder();
    const stream: IosSessionStream = { ...H264_STREAM, codec: "mjpeg", jpegQuality: 5 };
    const session = new SimcapScreenSession(config({ simcap: SIMCAP, ffmpeg: FFMPEG }), { udid: PHONE, name: "iPhone", maxSize: 1280, stream }, handlers, runner, fake.spawner);
    await session.start();
    expect(fake.spawned).toContainEqual([FFMPEG, ...ffmpegMjpegArgs(5)]);
    fake.outputs[SIMCAP].push(Buffer.concat([simcapSize(590, 1280), simcapPacket(SIMCAP_FLAGS.config, SPS_PPS), simcapPacket(SIMCAP_FLAGS.keyFrame, idr(1))]));
    await waitFor(() => fake.writes[FFMPEG]?.length === 2);
    expect(fake.writes[FFMPEG]).toEqual([SPS_PPS, idr(1)]);
    session.requestKeyFrame();
    expect(fake.writes[SIMCAP]).toBeUndefined();
    const frame = jpeg(590, 1280, 1);
    fake.outputs[FFMPEG].push(frame);
    await waitFor(() => events.jpegs.length === 1);
    expect(events.jpegs[0]).toEqual(frame);
    expect(events.sizes).toEqual([]);
    await session.stop(0);
    expect(fake.stops).toEqual(expect.arrayContaining([SIMCAP, FFMPEG, "/opt/bin/idb_companion"]));
    expect(events.failures).toEqual([]);
    fake.close();
  });

  test("mjpeg: while ffmpeg is behind, frames are dropped until a key frame asked for once it drained", async () => {
    const fake = tools();
    const { runner } = fakeRunner((cmd) => (cmd[1] === "describe" ? describeReply : {}));
    const { handlers } = recorder();
    const stream: IosSessionStream = { ...H264_STREAM, codec: "mjpeg" };
    const session = new SimcapScreenSession(config({ simcap: SIMCAP, ffmpeg: FFMPEG }), { udid: PHONE, name: "iPhone", maxSize: 1280, stream }, handlers, runner, fake.spawner);
    await session.start();
    const push = (...packets: Buffer[]) => fake.outputs[SIMCAP].push(Buffer.concat(packets));
    push(simcapSize(590, 1280), simcapPacket(SIMCAP_FLAGS.config, SPS_PPS), simcapPacket(SIMCAP_FLAGS.keyFrame, idr(1)), simcapPacket(0, delta(2)));
    await waitFor(() => fake.writes[FFMPEG]?.length === 3);

    fake.backlog[FFMPEG] = ENCODER_BACKLOG_BYTES + 1;
    push(simcapPacket(0, delta(3)), simcapPacket(SIMCAP_FLAGS.keyFrame, idr(4)), simcapPacket(SIMCAP_FLAGS.config, SPS_PPS));
    await waitFor(() => fake.writes[FFMPEG]?.length === 4);
    expect(fake.writes[SIMCAP]).toBeUndefined();

    fake.backlog[FFMPEG] = 0;
    push(simcapPacket(0, delta(5)), simcapPacket(0, delta(6)));
    await waitFor(() => fake.writes[SIMCAP]?.length === 1);
    push(simcapPacket(SIMCAP_FLAGS.keyFrame, idr(7)), simcapPacket(0, delta(8)));
    await waitFor(() => fake.writes[FFMPEG]?.length === 6);
    expect(fake.writes[FFMPEG]).toEqual([SPS_PPS, idr(1), delta(2), SPS_PPS, idr(7), delta(8)]);
    expect(fake.writes[SIMCAP]?.map(String)).toEqual(["k\n"]);
    await session.stop(0);
    fake.close();
  });

  test("exit 3 is the simulator shutting down, before or after the first key frame: no fallback", async () => {
    for (const keyed of [false, true]) {
      const fake = tools();
      const { runner } = fakeRunner((cmd) => (cmd[1] === "describe" ? describeReply : {}));
      const { events, handlers } = recorder();
      const session = new SimcapScreenSession(config({ simcap: SIMCAP }), { udid: PHONE, name: "iPhone", maxSize: 1280, stream: H264_STREAM }, handlers, runner, fake.spawner);
      await session.start();
      const packets = [simcapSize(590, 1280), simcapPacket(SIMCAP_FLAGS.config, SPS_PPS)];
      if (keyed) packets.push(simcapPacket(SIMCAP_FLAGS.keyFrame, idr(1)));
      fake.outputs[SIMCAP].push(Buffer.concat(packets));
      await waitFor(() => events.video.length === packets.length - 1);
      fake.outputs[SIMCAP].end();
      fake.exits[SIMCAP]?.(3);
      await waitFor(() => events.failures.length === 1);
      expect(events.failures).toEqual([IOS_SCREEN_MESSAGES.shutdown]);
      expect(events.fallbacks).toEqual([]);
      expect(fake.spawned.some((cmd) => cmd[0] === "/opt/bin/idb")).toBe(false);
      await session.stop(0);
      fake.close();
    }
  });

  test("a corrupt stream stops simcap and falls back with the parse error", async () => {
    const fake = tools();
    const { runner } = fakeRunner((cmd) => (cmd[1] === "describe" ? describeReply : {}));
    const { events, handlers } = recorder();
    const session = new SimcapScreenSession(config({ simcap: SIMCAP }), { udid: PHONE, name: "iPhone", maxSize: 1280, stream: H264_STREAM }, handlers, runner, fake.spawner);
    await session.start();
    const header = Buffer.alloc(5);
    header.writeUInt32BE(64 * 1024 * 1024, 0);
    fake.outputs[SIMCAP].push(Buffer.concat([simcapSize(590, 1280), header]));
    await waitFor(() => events.fallbacks.length === 1);
    expect(fake.stops).toContain(SIMCAP);
    expect(events.fallbacks[0]).toContain("tesseract-simcap sent a 67108864 byte packet");
    await waitFor(() => fake.spawned.at(-1)?.[0] === "/opt/bin/idb");
    expect(events.failures).toEqual([]);
    await session.stop(0);
    fake.close();
  });

  test("mjpeg: simcap exiting before the first key frame stops ffmpeg quietly and falls back", async () => {
    const fake = tools();
    const { runner } = fakeRunner((cmd) => (cmd[1] === "describe" ? describeReply : {}));
    const { events, handlers } = recorder();
    const stream: IosSessionStream = { ...H264_STREAM, codec: "mjpeg" };
    const session = new SimcapScreenSession(config({ simcap: SIMCAP, ffmpeg: FFMPEG }), { udid: PHONE, name: "iPhone", maxSize: 1280, stream }, handlers, runner, fake.spawner);
    await session.start();
    fake.outputs[SIMCAP].end();
    fake.exits[SIMCAP]?.(1);
    await waitFor(() => events.fallbacks.length === 1);
    expect(fake.stops).toContain(FFMPEG);
    await waitFor(() => fake.spawned.at(-1)?.[0] === FFMPEG && fake.spawned.at(-2)?.[0] === "/opt/bin/idb");
    await Bun.sleep(30);
    expect(events.failures).toEqual([]);
    await session.stop(0);
    fake.close();
  });

  test("a stop during the probe does not wait for it", async () => {
    const fake = tools();
    let probing = false;
    const { runner } = fakeRunner((cmd) => {
      if (cmd[1] === "describe") return describeReply;
      if (cmd[1] !== "probe") return {};
      probing = true;
      return new Promise<Reply>(() => {});
    });
    const { events, handlers } = recorder();
    const session = new SimcapScreenSession(config({ simcap: SIMCAP }), { udid: PHONE, name: "iPhone", maxSize: 1280, stream: H264_STREAM }, handlers, runner, fake.spawner);
    const started = session.start();
    await waitFor(() => probing);
    const begun = Date.now();
    await session.stop(0);
    expect(Date.now() - begun).toBeLessThan(1_000);
    await expect(started).rejects.toThrow(IOS_SCREEN_MESSAGES.ended);
    expect(fake.spawned.some((cmd) => cmd[0] === SIMCAP)).toBe(false);
    expect(events.failures).toEqual([]);
    fake.close();
  });

  test("falls back to idb without the helper, when its probe fails or when it exits before the first key frame", async () => {
    const run = async (simcap: string | null, probeOk: boolean) => {
      const fake = tools();
      const { runner } = fakeRunner((cmd) => (cmd[1] === "describe" ? describeReply : cmd[1] === "probe" ? { ok: probeOk, stdout: '{"ok":false,"message":"no screen port"}' } : {}));
      const { events, handlers } = recorder();
      const session = new SimcapScreenSession(config({ simcap }), { udid: PHONE, name: "iPhone", maxSize: 1280, stream: H264_STREAM }, handlers, runner, fake.spawner);
      await session.start();
      return { fake, events, session };
    };

    const missing = await run(null, true);
    expect(missing.events.fallbacks).toEqual(["tesseract-simcap is not installed on the host; set TESSERACT_SIMCAP"]);
    expect(missing.fake.spawned.at(-1)?.slice(0, 2)).toEqual(["/opt/bin/idb", "video-stream"]);
    await missing.session.stop(0);
    missing.fake.close();

    const refused = await run(SIMCAP, false);
    expect(refused.events.fallbacks[0]).toContain("tesseract-simcap probe failed");
    expect(refused.fake.spawned.some((cmd) => cmd[0] === SIMCAP)).toBe(false);
    await refused.session.stop(0);
    refused.fake.close();

    const early = await run(SIMCAP, true);
    expect(early.fake.spawned.map((cmd) => cmd[0])).toContain(SIMCAP);
    early.fake.outputs[SIMCAP].push(simcapSize(590, 1280));
    early.fake.outputs[SIMCAP].end();
    early.fake.exits[SIMCAP]?.(1);
    await waitFor(() => early.fake.spawned.at(-1)?.[0] === "/opt/bin/idb");
    expect(early.events.fallbacks[0]).toContain("tesseract-simcap exited before its first frame (code 1)");
    early.fake.outputs["/opt/bin/idb"].push(jpeg(603, 1311));
    await waitFor(() => early.events.jpegs.length === 1);
    expect(early.events.failures).toEqual([]);
    await early.session.stop(0);
    early.fake.close();
  });

  test("starts the helper before idb is up, so its first frame does not wait for idb_companion and idb describe", async () => {
    const fake = tools();
    let describing = false;
    let described!: (reply: Reply) => void;
    const { runner } = fakeRunner((cmd) => {
      if (cmd[1] !== "describe") return {};
      describing = true;
      return new Promise<Reply>((resolve) => (described = resolve));
    });
    const { handlers } = recorder();
    const session = new SimcapScreenSession(config({ simcap: SIMCAP }), { udid: PHONE, name: "iPhone", maxSize: 1280, stream: H264_STREAM }, handlers, runner, fake.spawner);
    const started = session.start();
    await waitFor(() => describing && fake.spawned.some((cmd) => cmd[0] === SIMCAP));
    described(describeReply);
    await started;
    expect(fake.spawned.filter((cmd) => cmd[0] === SIMCAP)).toHaveLength(1);
    await session.stop(0);
    fake.close();
  });
});

/** Stands in for the sandbox controller: tickets, the iOS link socket and stream sockets. */
function fakeSandbox(token: string) {
  const tickets = new Set<string>();
  const received: IosLinkHostMessage[] = [];
  const links: ServerWebSocket<{ kind: string; port?: string; id?: string }>[] = [];
  const streams: { id: string; port: string | null; data: Buffer[]; ws: ServerWebSocket<{ kind: string }> }[] = [];
  const server = Bun.serve<{ kind: string; port?: string; id?: string }>({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      const url = new URL(request.url);
      if (url.pathname === "/v1/auth/ticket" && request.method === "POST") {
        if (request.headers.get("authorization") !== `Bearer ${token}`) return Response.json({ error: { code: "unauthorized", message: "no" } }, { status: 401 });
        const ticket = crypto.randomUUID();
        tickets.add(ticket);
        return Response.json({ ticket, expiresAt: new Date(Date.now() + 60_000).toISOString() });
      }
      if (!tickets.delete(url.searchParams.get("ticket") ?? "")) return new Response("bad ticket", { status: 401 });
      if (url.pathname === "/v1/ios/link") return server.upgrade(request, { data: { kind: "link" } }) ? undefined : new Response("no", { status: 400 });
      const match = /^\/v1\/ios\/link\/streams\/(ios_[a-z0-9]+)$/.exec(url.pathname);
      if (match?.[1] && server.upgrade(request, { data: { kind: "stream", id: match[1], port: url.searchParams.get("port") ?? "" } })) return undefined;
      return new Response("not found", { status: 404 });
    },
    websocket: {
      open(ws) {
        if (ws.data.kind === "link") links.push(ws);
        else streams.push({ id: ws.data.id ?? "", port: ws.data.port ?? null, data: [], ws });
      },
      message(ws, message) {
        if (ws.data.kind === "link") received.push(IosLinkHostMessageSchema.parse(JSON.parse(String(message))));
        else {
          const stream = streams.find((entry) => entry.ws === ws);
          stream?.data.push(Buffer.from(message as Buffer));
          ws.send(Buffer.concat([Buffer.from("echo:"), Buffer.from(message as Buffer)]));
        }
      },
    },
  });
  const send = (message: IosLinkSandboxMessage) => links.at(-1)?.send(JSON.stringify(message));
  return { server, url: `http://127.0.0.1:${server.port}`, received, links, streams, send };
}

describe("IosLink", () => {
  const links: IosLink[] = [];
  afterEach(async () => {
    for (const link of links.splice(0)) await link.shutdown();
  });

  test("hello, simulator, the reverse Metro tunnel and vetted openUrl requests", async () => {
    const sandbox = fakeSandbox("tok");
    const opened: string[] = [];
    const link = new IosLink(
      {
        hostId: "macbook",
        version: "0.1.0",
        simulator: async () => ({ available: true, booted: { udid: PHONE, name: "iPhone", runtime: "iOS 26.0", state: "booted", widthPt: 402, heightPt: 874, scale: 3, error: "/Users/me/secret" } }),
        openUrl: async (url, _sdk, progress) => {
          progress("opening");
          opened.push(url);
        },
        install: async () => "com.example.app",
      },
      silentLogger,
      { reconnectMinMs: 20, reconnectMaxMs: 50 },
    );
    links.push(link);
    link.configure({ sandboxUrl: `${sandbox.url}/`, token: "tok" });
    await waitFor(() => sandbox.received.some((message) => message.type === "simulator"));
    expect(sandbox.received[0]).toEqual({ type: "hello", hostId: "macbook", version: "0.1.0" });
    expect(sandbox.received.find((message) => message.type === "simulator")).toMatchObject({ booted: { error: "The host simulator reported an error" } });
    expect(link.info()).toEqual({ configured: true, sandboxUrl: sandbox.url, connected: true, lastError: null });

    const port = await freePort();
    sandbox.send({ type: "runs", runs: [{ port, scheme: "myapp" }] });
    await waitFor(() => link.tunnelInfo().some((tunnel) => tunnel.listening));
    await waitFor(() => sandbox.received.some((message) => message.type === "tunnels" && message.tunnels.length === 1));

    const socket = await Bun.connect({
      hostname: "127.0.0.1",
      port,
      socket: { data: (_socket, data) => void replies.push(Buffer.from(data)) },
    });
    const replies: Buffer[] = [];
    socket.write("GET /status HTTP/1.1\r\n\r\n");
    await waitFor(() => Buffer.concat(replies).toString().startsWith("echo:GET /status"));
    expect(sandbox.streams[0]?.port).toBe(String(port));
    expect(link.streamCount).toBe(1);
    socket.end();
    await waitFor(() => link.streamCount === 0);

    sandbox.send({ type: "openUrl", requestId: "r1", url: "https://evil.example" });
    sandbox.send({ type: "openUrl", requestId: "r2", url: `exp://127.0.0.1:${port + 1}` });
    sandbox.send({ type: "openUrl", requestId: "r3", url: `exp://127.0.0.1:${port}` });
    sandbox.send({ type: "install", requestId: "r4", artifactId: "art_0123456789" });
    await waitFor(() => sandbox.received.filter((message) => message.type === "result").length === 4);
    const results = Object.fromEntries(sandbox.received.flatMap((message) => (message.type === "result" ? [[message.requestId, message]] : [])));
    expect(results.r1).toMatchObject({ ok: false, error: IOS_URL_REFUSALS.scheme });
    expect(results.r2).toMatchObject({ ok: false, error: IOS_URL_REFUSALS.expHost });
    expect(results.r3).toMatchObject({ ok: true, error: null });
    expect(results.r4).toMatchObject({ ok: true, bundleId: "com.example.app" });
    expect(sandbox.received).toContainEqual({ type: "progress", requestId: "r3", stage: "opening" });
    expect(opened).toEqual([`exp://127.0.0.1:${port}`]);

    sandbox.send({ type: "runs", runs: [] });
    await waitFor(() => link.tunnelInfo().length === 0);
    const refused = await Bun.connect({ hostname: "127.0.0.1", port, socket: { data: () => {} } }).then(
      () => false,
      () => true,
    );
    expect(refused).toBe(true);

    sandbox.send({ type: "ping" });
    await waitFor(() => sandbox.received.some((message) => message.type === "pong"));
    link.configure(null);
    expect(link.info().configured).toBe(false);
    sandbox.server.stop(true);
  });

  test("a taken Mac port is reported, not fatal", async () => {
    const sandbox = fakeSandbox("tok");
    const blocker = createServer().listen(0, "127.0.0.1");
    await new Promise((resolve) => blocker.once("listening", resolve));
    const port = (blocker.address() as { port: number }).port;
    const link = new IosLink({ hostId: "h", version: "v", simulator: async () => ({ available: false, booted: null }), openUrl: async () => {}, install: async () => null }, silentLogger);
    links.push(link);
    link.configure({ sandboxUrl: sandbox.url, token: "tok" });
    await waitFor(() => link.info().connected);
    sandbox.send({ type: "runs", runs: [{ port, scheme: null }] });
    await waitFor(() => link.tunnelInfo()[0]?.error);
    expect(link.tunnelInfo()).toEqual([{ port, listening: false, connections: 0, error: `Port ${port} is already in use on the Mac` }]);
    blocker.close();
    sandbox.server.stop(true);
  });

  test("linkSimulatorView hides host details", () => {
    expect(linkSimulatorView(null)).toBeNull();
  });
});

describe("IosInstalls", () => {
  async function simulatorBuild(dir: string): Promise<{ archive: string; sha256: string }> {
    const app = join(dir, "src", "MyApp.app");
    mkdirSync(app, { recursive: true });
    writeFileSync(join(app, "Info.plist"), "<plist/>");
    writeFileSync(join(app, "MyApp"), "binary");
    const archive = join(dir, "build.tar.gz");
    expect((await run(["tar", "-czf", archive, "-C", join(dir, "src"), "MyApp.app"])).ok).toBe(true);
    const sha256 = new Bun.CryptoHasher("sha256").update(await Bun.file(archive).arrayBuffer()).digest("hex");
    return { archive, sha256 };
  }

  function setup(approved: string[] = [], confirmTimeoutMs = 5_000) {
    const dir = makeTempDir("ios-install");
    const installedApps: string[] = [];
    const { runner, calls } = fakeRunner(async (cmd) => {
      if (cmd[0] === "tar") return run(cmd);
      if (cmd[0] === "plutil") return { stdout: "com.example.myapp\n" };
      if (cmd[2] === "install") installedApps.push(cmd[4] ?? "");
      return {};
    });
    const iosConfig = config({ platform: "linux" });
    const store = { list: [...approved] };
    const installs = new IosInstalls(
      iosConfig,
      runner,
      new Simctl(iosConfig, runner),
      { approved: () => store.list, approve: (sha256) => void store.list.push(sha256) },
      () => dir,
      silentLogger,
      { confirmTimeoutMs },
    );
    return { dir, installs, installedApps, calls, store };
  }

  function api(archive: string, sha256: string, fileName = "MyApp-simulator.tar.gz"): SandboxApi {
    return {
      artifact: async (id) => ({
        id,
        projectId: "app",
        buildId: null,
        fileName,
        path: "/workspace/app/build.tar.gz",
        sizeBytes: 100,
        sha256,
        platform: "ios-simulator",
        source: "agent",
        agentRunId: null,
        note: null,
        createdAt: "2026-10-19T10:00:00.000Z",
      }),
      download: async (_id, path, expected) => {
        const data = await Bun.file(archive).arrayBuffer();
        if (expected !== sha256) throw new Error("hash mismatch");
        await Bun.write(path, data);
      },
    };
  }

  test("an unknown bundle waits for approval, then installs; its hash is remembered", async () => {
    const { dir, installs, installedApps, store } = setup();
    const build = await simulatorBuild(dir);
    const stages: string[] = [];
    const done = installs.install(api(build.archive, build.sha256), "art_0123456789", PHONE, (stage) => stages.push(stage));
    const pending = await waitFor(() => installs.list().find((request) => request.state === "pending"));
    expect(pending).toMatchObject({ artifactId: "art_0123456789", sha256: build.sha256, udid: PHONE });
    expect(stages).toEqual(["awaiting_confirmation"]);
    expect(installs.decide(pending.id, true).state).toBe("approved");
    expect(await done).toBe("com.example.myapp");
    expect(stages).toEqual(["awaiting_confirmation", "downloading", "installing"]);
    expect(installedApps[0]).toEndWith("MyApp.app");
    expect(store.list).toEqual([build.sha256]);
    expect(installs.list()[0]).toMatchObject({ state: "installed", bundleId: "com.example.myapp" });
    expect(() => installs.decide(pending.id, true)).toThrow(INSTALL_MESSAGES.notPending("installed"));

    const again: string[] = [];
    expect(await installs.install(api(build.archive, build.sha256), "art_0123456789", PHONE, (stage) => again.push(stage))).toBe("com.example.myapp");
    expect(again).toEqual(["downloading", "installing"]);
  });

  test("rejected, expired and unsupported installs fail without installing", async () => {
    const { dir, installs, installedApps } = setup([], 100);
    const build = await simulatorBuild(dir);
    const rejected = installs.install(api(build.archive, build.sha256), "art_0123456789", PHONE, () => {});
    const pending = await waitFor(() => installs.list().find((request) => request.state === "pending"));
    installs.decide(pending.id, false);
    await expect(rejected).rejects.toThrow(INSTALL_MESSAGES.rejected);
    await expect(installs.install(api(build.archive, build.sha256), "art_0123456789", PHONE, () => {})).rejects.toThrow(INSTALL_MESSAGES.expired);
    expect(installs.list()[0]?.state).toBe("expired");
    await expect(installs.install(api(build.archive, build.sha256, "MyApp.ipa"), "art_0123456789", PHONE, () => {})).rejects.toThrow("Only simulator builds");
    expect(() => installs.decide("ins_missing0000", true)).toThrow("not found");
    expect(installedApps).toEqual([]);
  });
});

describe("host iOS API", () => {
  let shell: HostShell | null = null;
  let base = "";
  let token = "";

  afterEach(async () => {
    await shell?.stop();
    shell = null;
  });

  let stateFile = "";

  async function start(ios: IosConfig, mac = fakeMac(), factory?: (events: IosSessionEvents, target: IosScreenTarget) => void): Promise<string> {
    const dir = makeTempDir("host-ios");
    const hostConfig: HostConfig = { ...loadHostConfig({ HOME: dir, TESSERACT_HOST_SHELL_DIR: join(dir, "state"), PATH: "" }, { bind: "127.0.0.1", port: "0" }), ios };
    const store = new HostStateStore(hostConfig.stateDir, hostConfig.stateFile);
    stateFile = hostConfig.stateFile;
    await store.setPin(PIN);
    shell = startHostShell(hostConfig, {
      logger: silentLogger,
      ios: {
        runner: mac.runner,
        simulator: { watchMs: 0 },
        screen: {
          factory: (target, events) => {
            factory?.(events, target);
            return { start: async () => {}, stop: async () => {}, input: () => null, points: () => null };
          },
        },
      },
    });
    await shell.ready;
    base = shell.url.href.replace(/\/$/, "");
    token = store.ensureToken();
    const unlocked = await call("POST", "/v1/host/unlock", token, { pin: PIN });
    return HostSessionSchema.parse(unlocked.body).session;
  }

  async function call(method: string, path: string, auth: string | null, body?: unknown): Promise<{ status: number; body: any }> {
    const headers: Record<string, string> = {};
    if (auth) headers.Authorization = `Bearer ${auth}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  test("every iOS route needs a session", async () => {
    await start(config());
    for (const [method, path] of [
      ["GET", "/v1/ios"],
      ["POST", "/v1/ios/simulator"],
      ["DELETE", "/v1/ios/simulator"],
      ["POST", "/v1/ios/link"],
      ["DELETE", "/v1/ios/link"],
      ["GET", "/v1/ios/installs"],
      ["POST", "/v1/ios/installs/ins_0123456789"],
      ["GET", "/v1/ios/stream"],
      ["PUT", "/v1/ios/stream"],
    ] as const) {
      expect((await call(method, path, null)).status).toBe(401);
      expect((await call(method, path, token)).status).toBe(401);
    }
  });

  test("disabled by default: available false with reasonCode disabled, boot is 503", async () => {
    const session = await start(config({ enabled: false }));
    const status = HostIosStatusSchema.parse((await call("GET", "/v1/ios", session)).body);
    expect(status).toMatchObject({ available: false, reasonCode: "disabled", isolation: "none", devices: [], booted: null, installs: [] });
    expect((await call("POST", "/v1/ios/simulator", session, { udid: PHONE })).status).toBe(503);
    expect((await call("POST", "/v1/ios/link", session, { sandboxUrl: "http://100.64.0.2:7700", token: "t" })).status).toBe(503);
  });

  test("lists, boots and shuts down; signal is validated; the page is served", async () => {
    const mac = fakeMac();
    const session = await start(config(), mac);
    const status = HostIosStatusSchema.parse((await call("GET", "/v1/ios", session)).body);
    expect(status).toMatchObject({ available: true, xcode: "Xcode 26.0", idb: true, booted: null });
    expect(status.devices.map((device) => device.name)).toEqual(["iPad Air 11-inch (M3)", "iPhone 17 Pro"]);
    expect((await call("POST", "/v1/ios/simulator", session, { udid: "nope" })).status).toBe(400);
    const booting = await call("POST", "/v1/ios/simulator", session, { udid: PHONE });
    expect(booting.status).toBe(202);
    expect(booting.body.state).toBe("booting");
    await waitFor(async () => (await call("GET", "/v1/ios", session)).body.booted?.state === "booted");
    expect((await call("DELETE", "/v1/ios/simulator?signal=SIGHUP", session)).status).toBe(400);
    const stopping = await call("DELETE", "/v1/ios/simulator?signal=SIGTERM", session);
    expect(stopping.body.state).toBe("shutting_down");
    await waitFor(() => mac.states[PHONE] === "Shutdown");
    expect((await call("DELETE", "/v1/ios/simulator", session)).status).toBe(409);
    expect((await call("GET", "/v1/ios/installs", session)).body).toEqual([]);
    expect((await call("POST", "/v1/ios/installs/ins_0123456789", session, { approve: true })).status).toBe(404);
    expect((await call("DELETE", "/v1/android/emulator?signal=bad", session)).status).toBe(400);
    expect((await call("DELETE", "/v1/android/emulator?signal=SIGKILL", session)).status).toBe(200);

    const page = await fetch(`${base}/ui/ios`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('data-device="ios"');
    expect(html).not.toContain(token);
  });

  test("the screen socket checks its query, then streams the booted device", async () => {
    const mac = fakeMac();
    mac.states[PHONE] = "Booted";
    let events: IosSessionEvents | null = null;
    const session = await start(config(), mac, (created) => {
      events = created;
    });
    const ticket = async () => (await call("POST", "/v1/auth/ticket", session)).body.ticket as string;
    const bad = await fetch(`${base}/v1/ios/screen?ticket=${await ticket()}&udid=nope`, { headers: { upgrade: "websocket", connection: "upgrade", "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==", "sec-websocket-version": "13" } });
    expect(bad.status).toBe(400);
    const ws = new WebSocket(`${base.replace("http", "ws")}/v1/ios/screen?ticket=${await ticket()}&maxSize=720`);
    ws.binaryType = "arraybuffer";
    const texts: string[] = [];
    const binaries: ArrayBuffer[] = [];
    ws.addEventListener("message", (event) => (typeof event.data === "string" ? texts.push(event.data) : binaries.push(event.data as ArrayBuffer)));
    await waitFor(() => events);
    (events as unknown as IosSessionEvents).frame(jpeg(360, 720));
    await waitFor(() => binaries.length === 1);
    expect(JSON.parse(texts[0] ?? "{}")).toEqual({ type: "meta", deviceName: "iPhone 17 Pro", codec: "mjpeg", width: 360, height: 720 });
    ws.close();
  });

  test("stream settings: defaults, a validated PUT saved in state.json, and h264 screens on codec=h264", async () => {
    const mac = fakeMac();
    mac.states[PHONE] = "Booted";
    const targets: IosScreenTarget[] = [];
    const session = await start(config(), mac, (_events, target) => targets.push(target));
    expect(IosStreamSettingsSchema.parse((await call("GET", "/v1/ios/stream", session)).body)).toEqual(DEFAULT_IOS_STREAM);
    expect((await call("PUT", "/v1/ios/stream", session, { bitRate: 1 })).status).toBe(400);
    expect((await call("PUT", "/v1/ios/stream", session, { encoding: "vp9" })).status).toBe(400);
    const updated = await call("PUT", "/v1/ios/stream", session, { bitRate: 4_000_000, maxSize: 1024 });
    expect(updated.body).toEqual({ ...DEFAULT_IOS_STREAM, bitRate: 4_000_000, maxSize: 1024 });
    expect((await call("GET", "/v1/ios/stream", session)).body).toEqual(updated.body);
    expect(JSON.parse(await Bun.file(stateFile).text()).iosStream).toEqual({ bitRate: 4_000_000, maxSize: 1024 });

    const ticket = (await call("POST", "/v1/auth/ticket", session)).body.ticket as string;
    const ws = new WebSocket(`${base.replace("http", "ws")}/v1/ios/screen?ticket=${ticket}&maxSize=1280&codec=h264`);
    await waitFor(() => targets.length === 1);
    expect(targets[0]?.stream).toMatchObject({ codec: "h264", maxSize: 1024, bitRate: 4_000_000 });
    await call("PUT", "/v1/ios/stream", session, { encoding: "mjpeg" });
    await waitFor(() => targets.length === 2);
    expect(targets[1]?.stream?.codec).toBe("mjpeg");
    ws.close();
  });

  test("state.json keeps the valid iOS stream fields only", () => {
    const dir = makeTempDir("host-ios-state");
    writeFileSync(join(dir, "state.json"), JSON.stringify({ iosStream: { bitRate: 1, maxFps: 30, encoding: "vp9", device: "emulator-5554" } }));
    const store = new HostStateStore(dir, join(dir, "state.json"));
    expect(store.iosStreamSettings()).toEqual({ ...DEFAULT_IOS_STREAM, maxFps: 30 });
    expect(store.androidStreamSettings().maxFps).not.toBe(30);
  });
});
