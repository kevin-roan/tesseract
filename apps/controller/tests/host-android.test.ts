import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server as TcpServer, type Socket } from "node:net";
import { join } from "node:path";
import {
  AndroidLinkInfoSchema,
  DEFAULT_ANDROID_STREAM,
  EmulatorInfoSchema,
  HostAndroidStatusSchema,
  HostSessionSchema,
  type AndroidStreamSettings,
  type EmulatorInfo,
} from "@theone/protocol";
import { silentLogger } from "../src/core/logger";
import { HostConfigError, loadHostConfig, type HostConfig } from "../src/host/config";
import { defaultGpu, defaultIsolation, loadAndroidConfig, parseScrcpyVersion, SCRCPY_SERVER_PATHS, type AndroidConfig } from "../src/host/android/config";
import { EMULATOR_MESSAGES, EmulatorManager, parseAvdList, parseWmSize } from "../src/host/android/emulator";
import { parseAdbDevices } from "../src/host/android/devices";
import { HostAndroid } from "../src/host/android";
import { runtimePaths } from "../src/host/android/netns-helper";
import { AndroidScreens, type ScreenClient } from "../src/host/android/screen";
import { startHostShell, type HostShell } from "../src/host/server";
import { HostStateStore } from "../src/host/state";
import { makeTempDir, processGone, removeTempDirs, waitFor } from "./helpers";

const PIN = "482913";
const ENTRY = join(import.meta.dir, "..", "src", "index.ts");

function script(path: string, body: string): string {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(path, 0o755);
  return path;
}

type Fakes = { dir: string; sdk: string; adb: string; emulator: string; config: AndroidConfig };

/** A fake SDK whose `emulator` boots by touching marker files that the fake `adb` reads. */
function fakeAndroid(overrides: Partial<AndroidConfig> = {}): Fakes {
  const dir = makeTempDir("android");
  const sdk = join(dir, "sdk");
  const emulator = script(
    join(sdk, "emulator", "emulator"),
    `D=${dir}
echo "$*" >> "$D/emulator.argv"
if [ "$1" = "-list-avds" ]; then printf 'INFO    | Storing crashdata in: /tmp\\nPixel_5\\nTablet_API_34\\n'; exit 0; fi
if [ -f "$D/crash" ]; then echo "PANIC: Broken AVD system path"; exit 3; fi
echo "emulator: booting"
echo $$ > "$D/emulator.pid"
trap 'rm -f "$D/online" "$D/booted"; exit 0' TERM
touch "$D/online"
if [ ! -f "$D/noboot" ]; then (sleep 0.3; touch "$D/booted") & fi
while true; do sleep 0.05; done`,
  );
  const adb = script(
    join(dir, "bin", "adb"),
    `D=${dir}
echo "$*" >> "$D/adb.argv"
case "$1" in
  connect) echo "connected to $2"; exit 0 ;;
  disconnect) echo "disconnected $2"; exit 0 ;;
esac
[ "$1" = "-s" ] && shift 2
case "$1 $2" in
  "push "*) exit 0 ;;
  "forward tcp:0") sleep "$(cat "$D/forward.delay" 2>/dev/null || echo 0)"; cat "$D/forward.port"; exit 0 ;;
  "forward --remove") exit 0 ;;
  "shell CLASSPATH="*) exec sleep 30 ;;
  get-state*) if [ -f "$D/online" ]; then echo device; exit 0; fi; echo "error: device not found" >&2; exit 1 ;;
  "shell getprop") [ -f "$D/booted" ] && echo 1 || echo ""; exit 0 ;;
  "shell wm") printf 'Physical size: 1080x2340\\nOverride size: 720x1560\\n' ;;
  "emu avd") printf 'Pixel_5\\nOK\\n' ;;
  "emu kill") rm -f "$D/online" "$D/booted"; echo OK ;;
esac`,
  );
  return {
    dir,
    sdk,
    adb,
    emulator,
    config: {
      sdkRoot: sdk,
      emulator,
      adb,
      scrcpyServer: null,
      scrcpyVersion: null,
      ffmpeg: null,
      emulatorPort: 5554,
      gpu: "swiftshader_indirect",
      isolation: "none",
      unshare: null,
      ip: null,
      allowNets: [],
      adbBridgePort: null,
      shareEmulators: false,
      runtimeDir: join(dir, "run"),
      ...overrides,
    },
  };
}

const argv = (fakes: Fakes, tool: "adb" | "emulator") => {
  const file = join(fakes.dir, `${tool}.argv`);
  return existsSync(file) ? readFileSync(file, "utf8").trim().split("\n") : [];
};

const managers: EmulatorManager[] = [];

function manager(fakes: Fakes, options: ConstructorParameters<typeof EmulatorManager>[2] = {}, config: AndroidConfig = fakes.config): EmulatorManager {
  const created = new EmulatorManager(config, silentLogger, { bootPollMs: 50, stopGraceMs: 2_000, watchMs: 0, ...options });
  managers.push(created);
  return created;
}

afterEach(async () => {
  for (const created of managers.splice(0)) {
    created.stop();
    await created.shutdown();
  }
});

afterAll(() => removeTempDirs());

describe("android config", () => {
  test("prefers the bundled SDK under $HOME, then ANDROID_SDK_ROOT, then ANDROID_HOME", () => {
    const home = makeTempDir("android-home");
    expect(loadAndroidConfig({ HOME: home, PATH: "", ANDROID_SDK_ROOT: "/opt/sdk", ANDROID_HOME: "/opt/home" }).sdkRoot).toBe("/opt/sdk");
    expect(loadAndroidConfig({ HOME: home, PATH: "", ANDROID_HOME: "/opt/home" }).sdkRoot).toBe("/opt/home");
    expect(loadAndroidConfig({ HOME: home, PATH: "" }).sdkRoot).toBeNull();
    const bundled = join(home, ".local", "share", "theone", "android-sdk");
    script(join(bundled, "emulator", "emulator"), "exit 0");
    const config = loadAndroidConfig({ HOME: home, PATH: "", ANDROID_SDK_ROOT: "/opt/sdk" });
    expect(config.sdkRoot).toBe(bundled);
    expect(config.emulator).toBe(join(bundled, "emulator", "emulator"));
    expect(loadAndroidConfig({ HOME: home, PATH: "", THEONE_ANDROID_SDK_ROOT: "/elsewhere" }).sdkRoot).toBe("/elsewhere");
  });

  test("resolves tools from overrides or PATH, with defaults for port and GPU", () => {
    const fakes = fakeAndroid();
    const bin = join(fakes.dir, "bin");
    script(join(bin, "ffmpeg"), "exit 0");
    script(join(bin, "scrcpy"), 'echo "scrcpy 4.1 <https://github.com/Genymobile/scrcpy>"');
    const jar = join(fakes.dir, "scrcpy-server");
    writeFileSync(jar, "jar");
    const config = loadAndroidConfig({ HOME: fakes.dir, PATH: `${bin}:/usr/bin:/bin`, THEONE_ANDROID_SDK_ROOT: fakes.sdk, THEONE_SCRCPY_SERVER: jar, XDG_RUNTIME_DIR: "/run/user/7" });
    expect(config).toEqual({
      sdkRoot: fakes.sdk,
      emulator: fakes.emulator,
      adb: fakes.adb,
      scrcpyServer: jar,
      scrcpyVersion: "4.1",
      ffmpeg: join(bin, "ffmpeg"),
      emulatorPort: 5554,
      gpu: defaultGpu(),
      isolation: "netns",
      unshare: Bun.which("unshare", { PATH: `${bin}:/usr/bin:/bin` }),
      ip: Bun.which("ip", { PATH: `${bin}:/usr/bin:/bin:/usr/sbin:/sbin` }),
      allowNets: [],
      adbBridgePort: null,
      shareEmulators: false,
      runtimeDir: "/run/user/7/theone",
    });
    const custom = loadAndroidConfig({
      HOME: fakes.dir,
      PATH: "",
      THEONE_ADB: fakes.adb,
      THEONE_FFMPEG: "/missing/ffmpeg",
      THEONE_SCRCPY_VERSION: "3.3",
      THEONE_SCRCPY_SERVER: "/missing/jar",
      THEONE_EMULATOR_PORT: "5560",
      THEONE_EMULATOR_GPU: "host",
    });
    expect(custom).toMatchObject({ adb: fakes.adb, ffmpeg: null, scrcpyVersion: "3.3", scrcpyServer: null, emulatorPort: 5560, gpu: "host" });
  });

  test("THEONE_ANDROID_SHARE_EMULATORS is an on/off switch, off by default", () => {
    const home = makeTempDir("android-share");
    expect(loadAndroidConfig({ HOME: home, PATH: "" }).shareEmulators).toBe(false);
    expect(loadAndroidConfig({ HOME: home, PATH: "", THEONE_ANDROID_SHARE_EMULATORS: "on" }).shareEmulators).toBe(true);
    expect(loadAndroidConfig({ HOME: home, PATH: "", THEONE_ANDROID_SHARE_EMULATORS: "1" }).shareEmulators).toBe(true);
    expect(loadAndroidConfig({ HOME: home, PATH: "", THEONE_ANDROID_SHARE_EMULATORS: "off" }).shareEmulators).toBe(false);
    expect(() => loadAndroidConfig({ HOME: home, PATH: "", THEONE_ANDROID_SHARE_EMULATORS: "maybe" })).toThrow("THEONE_ANDROID_SHARE_EMULATORS");
  });

  test("uses the host GPU only when a render node can be opened", () => {
    const dri = makeTempDir("dri");
    expect(defaultGpu(join(dri, "missing"))).toBe("swiftshader_indirect");
    writeFileSync(join(dri, "card0"), "");
    expect(defaultGpu(dri)).toBe("swiftshader_indirect");
    writeFileSync(join(dri, "renderD128"), "");
    chmodSync(join(dri, "renderD128"), 0o400);
    expect(defaultGpu(dri)).toBe("swiftshader_indirect");
    chmodSync(join(dri, "renderD128"), 0o600);
    expect(defaultGpu(dri)).toBe("host");
  });

  test("defaults to no isolation and the host GPU on macOS, without probing Linux tools", () => {
    const home = makeTempDir("android-mac");
    const config = loadAndroidConfig({ HOME: home, PATH: "/usr/bin:/bin" }, "darwin");
    expect(config).toMatchObject({ isolation: "none", gpu: "host", unshare: null, ip: null });
    expect(defaultGpu(join(home, "missing"), "darwin")).toBe("host");
    expect(defaultIsolation("linux")).toBe("netns");
    expect(defaultIsolation("darwin")).toBe("none");
    expect(loadAndroidConfig({ HOME: home, PATH: "", THEONE_EMULATOR_GPU: "swiftshader_indirect" }, "darwin").gpu).toBe("swiftshader_indirect");
    expect(loadAndroidConfig({ HOME: home, PATH: "", THEONE_EMULATOR_ISOLATION: "netns" }, "darwin")).toMatchObject({ isolation: "netns", unshare: null, ip: null });
    expect(SCRCPY_SERVER_PATHS).toContain("/opt/homebrew/share/scrcpy/scrcpy-server");
  });

  test("finds the desktop app's or Android Studio's SDK on macOS", () => {
    const home = makeTempDir("android-mac-sdk");
    const studio = join(home, "Library", "Android", "sdk");
    script(join(studio, "emulator", "emulator"), "exit 0");
    expect(loadAndroidConfig({ HOME: home, PATH: "" }, "darwin").sdkRoot).toBe(studio);
    const bundled = join(home, "Library", "Application Support", "Monolith", "android-sdk");
    script(join(bundled, "emulator", "emulator"), "exit 0");
    expect(loadAndroidConfig({ HOME: home, PATH: "", ANDROID_SDK_ROOT: "/opt/sdk" }, "darwin").sdkRoot).toBe(bundled);
    expect(loadAndroidConfig({ HOME: home, PATH: "", ANDROID_SDK_ROOT: "/opt/sdk" }, "linux").sdkRoot).toBe("/opt/sdk");
  });

  test("rejects an emulator port the emulator would not accept", () => {
    expect(() => loadAndroidConfig({ PATH: "", THEONE_EMULATOR_PORT: "5555" })).toThrow(HostConfigError);
    expect(() => loadAndroidConfig({ PATH: "", THEONE_EMULATOR_PORT: "abc" })).toThrow(HostConfigError);
  });

  test("parses tool output", () => {
    expect(parseScrcpyVersion("scrcpy 4.1 <https://github.com/Genymobile/scrcpy>\n\nDependencies")).toBe("4.1");
    expect(parseScrcpyVersion("nope")).toBeNull();
    expect(parseWmSize("Physical size: 1080x2340\n")).toEqual({ width: 1080, height: 2340 });
    expect(parseWmSize("Physical size: 1080x2340\nOverride size: 720x1560\n")).toEqual({ width: 720, height: 1560 });
    expect(parseAvdList("INFO    | Storing crashdata\nPixel_5\n\nTablet_API_34\n")).toEqual(["Pixel_5", "Tablet_API_34"]);
  });
});

describe("emulator manager", () => {
  test("starts the AVD detached with the documented flags and polls until booted", async () => {
    const fakes = fakeAndroid();
    const emulator = manager(fakes);
    const states: string[] = [];
    emulator.onChange((info) => states.push(info.state));
    await emulator.init();
    expect(emulator.current().state).toBe("stopped");
    expect(await emulator.listAvds()).toEqual(["Pixel_5", "Tablet_API_34"]);

    const started = await emulator.start({ avd: "Pixel_5", coldBoot: true, wipeData: true });
    expect(EmulatorInfoSchema.parse(started)).toMatchObject({ state: "starting", avd: "Pixel_5", serial: "emulator-5554", managed: true, isolated: false });
    const running = await waitFor(() => (emulator.current().state === "running" ? emulator.current() : null));
    expect(running).toMatchObject({ managed: true, width: 720, height: 1560, error: null });
    expect(argv(fakes, "emulator")).toContain(
      "-avd Pixel_5 -port 5554 -no-window -no-audio -no-boot-anim -skip-adb-auth -gpu swiftshader_indirect -no-snapshot-load -wipe-data",
    );
    expect(argv(fakes, "adb")).toContain("-s emulator-5554 shell getprop sys.boot_completed");
    const pid = Number(readFileSync(join(fakes.dir, "emulator.pid"), "utf8"));

    await expect(emulator.start({ avd: "Pixel_5" })).rejects.toMatchObject({ status: 409 });
    expect(emulator.stop().state).toBe("stopping");
    await waitFor(() => emulator.current().state === "stopped");
    expect(emulator.current()).toEqual({ state: "stopped", avd: null, serial: null, managed: false, isolated: false, width: null, height: null, startedAt: null, error: null });
    await waitFor(() => processGone(pid));
    expect(states).toEqual(["starting", "running", "stopping", "stopped"]);
  });

  test("adopts an emulator that is already running and stops it over the console", async () => {
    const fakes = fakeAndroid();
    writeFileSync(join(fakes.dir, "online"), "");
    writeFileSync(join(fakes.dir, "booted"), "");
    const emulator = manager(fakes);
    await emulator.init();
    expect(emulator.current()).toMatchObject({ state: "running", avd: "Pixel_5", serial: "emulator-5554", managed: false, isolated: false, width: 720, height: 1560 });
    expect(emulator.stop().state).toBe("stopping");
    await waitFor(() => emulator.current().state === "stopped");
    expect(argv(fakes, "adb")).toContain("-s emulator-5554 emu kill");
    expect(argv(fakes, "emulator")).toEqual([]);
  });

  test("notices an adopted emulator going away and a new one appearing", async () => {
    const fakes = fakeAndroid();
    writeFileSync(join(fakes.dir, "online"), "");
    writeFileSync(join(fakes.dir, "booted"), "");
    const emulator = manager(fakes, { watchMs: 50 });
    await emulator.init();
    expect(emulator.current().state).toBe("running");
    Bun.spawnSync(["rm", "-f", join(fakes.dir, "online"), join(fakes.dir, "booted")]);
    const gone = await waitFor(() => (emulator.current().state === "stopped" ? emulator.current() : null));
    expect(gone.error).toBe("The emulator exited");
    writeFileSync(join(fakes.dir, "online"), "");
    writeFileSync(join(fakes.dir, "booted"), "");
    await waitFor(() => emulator.current().state === "running");
    expect(emulator.current().managed).toBe(false);
  });

  test("an emulator that exits on its own is failed with the last log line", async () => {
    const fakes = fakeAndroid();
    writeFileSync(join(fakes.dir, "crash"), "");
    const emulator = manager(fakes);
    await emulator.init();
    await emulator.start({ avd: "Pixel_5" });
    const failed = await waitFor(() => (emulator.current().state === "failed" ? emulator.current() : null));
    expect(failed.error).toBe("The emulator exited with code 3: PANIC: Broken AVD system path");
    expect(failed.avd).toBe("Pixel_5");
    await emulator.start({ avd: "Tablet_API_34" });
  });

  test("a boot that never completes fails and the emulator is stopped", async () => {
    const fakes = fakeAndroid();
    writeFileSync(join(fakes.dir, "noboot"), "");
    const emulator = manager(fakes, { bootTimeoutMs: 300 });
    await emulator.init();
    await emulator.start({ avd: "Pixel_5" });
    const failed = await waitFor(() => (emulator.current().state === "failed" ? emulator.current() : null));
    expect(failed.error).toContain("did not boot");
    const pid = Number(readFileSync(join(fakes.dir, "emulator.pid"), "utf8"));
    await waitFor(() => processGone(pid));
  });

  test("refuses unknown AVDs and missing tools", async () => {
    const fakes = fakeAndroid();
    const emulator = manager(fakes);
    await expect(emulator.start({ avd: "Nexus_9" })).rejects.toMatchObject({ status: 404 });
    const missing = manager(fakeAndroid({ adb: null }));
    expect(missing.current().state).toBe("unavailable");
    await expect(missing.start({ avd: "Pixel_5" })).rejects.toMatchObject({ status: 503 });
  });
});

/** `unshare` and `ip` that only run the command, and a helper on ephemeral ports: the isolation path without namespaces. */
function fakeIsolation(fakes: Fakes): { config: AndroidConfig; helper: string[] } {
  const bin = join(fakes.dir, "bin");
  const unshare = script(join(bin, "unshare"), 'while [ "$1" != "--" ]; do shift; done; shift; exec "$@"');
  const ip = script(join(bin, "ip"), "exit 0");
  const helper = script(join(bin, "helper"), `exec ${process.execPath} ${ENTRY} "$@" --dns-port 0 --proxy-port 0`);
  return { config: { ...fakes.config, isolation: "netns", unshare, ip }, helper: [helper] };
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe("isolated emulator", () => {
  test("starts behind the adb bridge, survives a daemon restart, and is torn down completely", async () => {
    const fakes = fakeAndroid();
    const { config, helper } = fakeIsolation(fakes);
    const first = manager(fakes, { helperCommand: helper }, config);
    await first.init();
    expect(first.unavailableReason()).toBeNull();
    const started = await first.start({ avd: "Pixel_5" });
    expect(started).toMatchObject({ state: "starting", managed: true, isolated: true });
    expect(started.serial).toMatch(/^127\.0\.0\.1:\d+$/);
    const serial = started.serial ?? "";
    await waitFor(() => first.current().state === "running");
    expect(argv(fakes, "emulator").at(-1)).toEndWith("-http-proxy http://127.0.0.1:3128 -dns-server 127.0.0.1");
    expect(argv(fakes, "adb")).toContain(`connect ${serial}`);
    expect(argv(fakes, "adb")).toContain(`-s ${serial} shell getprop sys.boot_completed`);
    expect(first.adbdEndpoint()).toEqual({ path: runtimePaths(join(config.runtimeDir, "emulator-5554")).adbd });
    expect(first.linkRefusal()).toBeNull();

    const paths = runtimePaths(join(config.runtimeDir, "emulator-5554"));
    const emulatorPid = Number(readFileSync(join(fakes.dir, "emulator.pid"), "utf8"));
    const helperPid = Number(readFileSync(paths.helperPid, "utf8"));
    expect(statSync(paths.dir).mode & 0o777).toBe(0o700);

    await first.shutdown();
    expect(alive(emulatorPid)).toBe(true);
    expect(alive(helperPid)).toBe(true);

    const second = manager(fakes, { helperCommand: helper }, config);
    await second.init();
    expect(second.current()).toMatchObject({ state: "running", managed: false, isolated: true, serial, avd: "Pixel_5" });

    expect(second.stop().state).toBe("stopping");
    await waitFor(() => second.current().state === "stopped");
    await waitFor(() => processGone(emulatorPid) && processGone(helperPid));
    expect(existsSync(paths.dir)).toBe(false);
    expect(argv(fakes, "adb")).toContain(`disconnect ${serial}`);
  });

  test("an emulator that was not started isolated can be viewed but not linked", async () => {
    const fakes = fakeAndroid();
    const { config, helper } = fakeIsolation(fakes);
    writeFileSync(join(fakes.dir, "online"), "");
    writeFileSync(join(fakes.dir, "booted"), "");
    const emulator = manager(fakes, { helperCommand: helper }, config);
    await emulator.init();
    expect(emulator.current()).toMatchObject({ state: "running", serial: "emulator-5554", managed: false, isolated: false });
    expect(emulator.linkRefusal()).toBe(EMULATOR_MESSAGES.notIsolated);
    expect(emulator.adbdEndpoint()).toEqual({ host: "127.0.0.1", port: 5555 });
  });

  test("reports why isolation is unavailable", async () => {
    const fakes = fakeAndroid();
    const missing = manager(fakes, {}, { ...fakes.config, isolation: "netns", unshare: null, ip: null });
    expect(missing.unavailableReason()).toBe(EMULATOR_MESSAGES.noIsolationTools);
    expect(missing.unavailableReason()).toContain("THEONE_EMULATOR_ISOLATION=none");
    expect(missing.unavailableReason()).toContain("Linux host");
    const refusing = script(join(fakes.dir, "bin", "unshare-denied"), 'echo "unshare: unshare failed: Operation not permitted" >&2; exit 1');
    const denied = manager(fakes, {}, { ...fakes.config, isolation: "netns", unshare: refusing, ip: "/usr/bin/true" });
    expect(denied.unavailableReason()).toContain("Operation not permitted");
    await expect(denied.start({ avd: "Pixel_5" })).rejects.toMatchObject({ status: 503 });
  });
});

describe("adopted emulator that never boots", () => {
  test("stays failed instead of being adopted again every watch tick, until it goes away", async () => {
    const fakes = fakeAndroid();
    writeFileSync(join(fakes.dir, "online"), "");
    const emulator = manager(fakes, { bootTimeoutMs: 150, watchMs: 30 });
    const states: string[] = [];
    emulator.onChange((info) => states.push(info.state));
    await emulator.init();
    await waitFor(() => emulator.current().state === "failed");
    await Bun.sleep(300);
    expect(states).toEqual(["starting", "failed"]);
    await expect(emulator.start({ avd: "Pixel_5" })).rejects.toMatchObject({ status: 409 });
    Bun.spawnSync(["rm", "-f", join(fakes.dir, "online")]);
    const gone = await waitFor(() => (emulator.current().state === "stopped" ? emulator.current() : null));
    expect(gone.error).toBe("The emulator exited");
  });
});

/** Stands in for scrcpy-server behind `adb forward`: the first connection is video, the second control. */
function videoPacket(data: Buffer, flags: { config?: boolean; keyFrame?: boolean } = {}): Buffer {
  const header = Buffer.alloc(12);
  header.writeUInt32BE((flags.config ? 0x40000000 : 0) | (flags.keyFrame ? 0x20000000 : 0), 0);
  header.writeUInt32BE(data.length, 8);
  return Buffer.concat([header, data]);
}

async function fakeScrcpy(frames: Buffer[] = []): Promise<{ server: TcpServer; port: number; control: Buffer[] }> {
  const control: Buffer[] = [];
  let connections = 0;
  const preamble = Buffer.alloc(69);
  preamble.write("sdk_gphone64_x86_64", 1, "utf8");
  preamble.write("h264", 65, "latin1");
  const session = Buffer.alloc(12);
  session.writeUInt32BE(0x80000000, 0);
  session.writeUInt32BE(1080, 4);
  session.writeUInt32BE(2340, 8);
  const server = createServer((socket: Socket) => {
    socket.on("error", () => {});
    connections += 1;
    if (connections % 2 === 1) socket.write(Buffer.concat([preamble, session, ...frames]));
    else socket.on("data", (chunk: Buffer) => control.push(chunk));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return { server, port: typeof address === "object" && address ? address.port : 0, control };
}

type Touch = { action: number; pointerId: bigint; x: number; y: number };

function touches(control: Buffer[]): Touch[] {
  const bytes = Buffer.concat(control);
  const result: Touch[] = [];
  for (let offset = 0; offset + 32 <= bytes.length; offset += 32) {
    expect(bytes[offset]).toBe(2);
    result.push({ action: bytes[offset + 1] ?? -1, pointerId: bytes.readBigInt64BE(offset + 2), x: bytes.readInt32BE(offset + 10), y: bytes.readInt32BE(offset + 14) });
  }
  return result;
}

function viewer(): { client: ScreenClient; messages: unknown[]; frames: string[] } {
  const messages: unknown[] = [];
  const frames: string[] = [];
  return {
    messages,
    frames,
    client: { send: (message) => messages.push(message), sendFrame: (frame) => frames.push(Buffer.from(frame).toString("hex")), bufferedAmount: () => 0, close: () => {} },
  };
}

describe("adb devices", () => {
  test("parses adb devices -l and tells emulators, Genymotion, network and USB devices apart", () => {
    const output = `List of devices attached
emulator-5554          device product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64 device:emu64xa transport_id:1
127.0.0.1:41555        device product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64 device:emu64xa transport_id:2
192.168.56.101:5555    device product:vbox86p model:Google_Pixel_3 device:vbox86p transport_id:3
192.168.2.5:41479      device product:PacmanIND model:A142 device:Pacman transport_id:4
R5CT20ABCDE            unauthorized usb:1-1 transport_id:5
`;
    expect(parseAdbDevices(output, "127.0.0.1:41555")).toEqual([
      { serial: "emulator-5554", state: "device", kind: "emulator", model: "sdk gphone64 x86 64", hostEmulator: false },
      { serial: "127.0.0.1:41555", state: "device", kind: "emulator", model: "sdk gphone64 x86 64", hostEmulator: true },
      { serial: "192.168.56.101:5555", state: "device", kind: "genymotion", model: "Google Pixel 3", hostEmulator: false },
      { serial: "192.168.2.5:41479", state: "device", kind: "network", model: "A142", hostEmulator: false },
      { serial: "R5CT20ABCDE", state: "unauthorized", kind: "usb", model: null, hostEmulator: false },
    ]);
    expect(parseAdbDevices("* daemon started successfully\nList of devices attached\n\n", "emulator-5554")).toEqual([]);
  });
});

describe("stream settings", () => {
  test("only valid changed fields are stored", () => {
    const dir = makeTempDir("stream");
    const store = new HostStateStore(dir, join(dir, "state.json"));
    expect(store.androidStreamSettings()).toEqual(DEFAULT_ANDROID_STREAM);
    expect(store.updateAndroidStream({ bitRate: 4_000_000, device: "192.168.2.5:41479" })).toEqual({ ...DEFAULT_ANDROID_STREAM, bitRate: 4_000_000, device: "192.168.2.5:41479" });
    writeFileSync(join(dir, "state.json"), JSON.stringify({ androidStream: { bitRate: 1, maxFps: 30, encoding: "vp9" } }));
    expect(store.androidStreamSettings()).toEqual({ ...DEFAULT_ANDROID_STREAM, maxFps: 30 });
  });
});

describe("android screen sessions", () => {
  async function screens(fakes: Fakes, scrcpyPort: number, settings: Partial<AndroidStreamSettings> = {}, current = () => settings) {
    writeFileSync(join(fakes.dir, "online"), "");
    writeFileSync(join(fakes.dir, "booted"), "");
    writeFileSync(join(fakes.dir, "forward.port"), String(scrcpyPort));
    const bin = join(fakes.dir, "bin");
    const jar = join(fakes.dir, "scrcpy-server");
    writeFileSync(jar, "jar");
    const config: AndroidConfig = { ...fakes.config, scrcpyServer: jar, scrcpyVersion: "4.1", ffmpeg: script(join(bin, "ffmpeg"), "exec cat > /dev/null") };
    const emulator = manager(fakes, {}, config);
    await emulator.init();
    expect(emulator.running).toBe(true);
    const created = new AndroidScreens(config, emulator, silentLogger, { connectTimeoutMs: 2_000, settings: () => ({ ...DEFAULT_ANDROID_STREAM, ...current() }) });
    return created;
  }

  test("offsets each viewer's pointer ids and lifts a leaving viewer's pointers", async () => {
    const fakes = fakeAndroid();
    const scrcpy = await fakeScrcpy();
    const android = await screens(fakes, scrcpy.port);
    const a = viewer();
    const b = viewer();
    const detachA = android.attach(a.client, { maxSize: 720 });
    const detachB = android.attach(b.client);
    await waitFor(() => a.messages.length > 0 && b.messages.length > 0);
    expect(a.messages[0]).toEqual({ type: "meta", deviceName: "sdk_gphone64_x86_64", codec: "mjpeg", width: 1080, height: 2340 });
    expect(argv(fakes, "adb").find((line) => line.includes("scrcpy.Server"))).toContain("max_size=720");

    const at = { width: 1080, height: 2340, pressure: 1 };
    android.handle(a.client, { type: "touch", action: "down", pointerId: 0, x: 100, y: 200, ...at });
    android.handle(a.client, { type: "touch", action: "move", pointerId: 0, x: 110, y: 210, ...at });
    android.handle(b.client, { type: "touch", action: "down", pointerId: 0, x: 500, y: 600, ...at });
    android.handle(b.client, { type: "touch", action: "up", pointerId: 0, x: 500, y: 600, ...at, pressure: 0 });
    await waitFor(() => touches(scrcpy.control).length === 4);
    expect(touches(scrcpy.control).map((touch) => [touch.action, touch.pointerId])).toEqual([
      [0, 0n],
      [2, 0n],
      [0, 10n],
      [1, 10n],
    ]);

    detachA();
    await waitFor(() => touches(scrcpy.control).length === 5);
    expect(touches(scrcpy.control)[4]).toEqual({ action: 1, pointerId: 0n, x: 110, y: 210 });
    detachB();
    await waitFor(() => argv(fakes, "adb").some((line) => line.includes("forward --remove")));
    await android.shutdown();
    scrcpy.server.close();
  });

  test("the smallest maxSize is clamped", async () => {
    const fakes = fakeAndroid();
    const scrcpy = await fakeScrcpy();
    const android = await screens(fakes, scrcpy.port);
    const a = viewer();
    android.attach(a.client, { maxSize: 8 });
    await waitFor(() => a.messages.length > 0);
    expect(argv(fakes, "adb").find((line) => line.includes("scrcpy.Server"))).toContain("max_size=160");
    await android.shutdown();
    scrcpy.server.close();
  });

  test("H.264 is passed through with flags and a late viewer gets the config and the frames since the key frame", async () => {
    const fakes = fakeAndroid();
    const config = Buffer.from("00000001674d", "hex");
    const key = Buffer.from("0000000165aa", "hex");
    const delta = Buffer.from("0000000141bb", "hex");
    const scrcpy = await fakeScrcpy([videoPacket(config, { config: true }), videoPacket(key, { keyFrame: true }), videoPacket(delta)]);
    const android = await screens(fakes, scrcpy.port, { bitRate: 2_000_000, maxFps: 24, keyFrameInterval: 3, maxSize: 600 });
    const a = viewer();
    android.attach(a.client, { maxSize: 1080, codec: "h264" });
    const expected = [`01${config.toString("hex")}`, `02${key.toString("hex")}`, `00${delta.toString("hex")}`];
    await waitFor(() => a.frames.length === 3);
    expect(a.messages[0]).toEqual({ type: "meta", deviceName: "sdk_gphone64_x86_64", codec: "h264", width: 1080, height: 2340 });
    expect(a.frames).toEqual(expected);
    const server = argv(fakes, "adb").find((line) => line.includes("scrcpy.Server")) ?? "";
    for (const arg of ["max_size=600", "video_bit_rate=2000000", "max_fps=24", "video_codec_options=i-frame-interval:int=3"]) expect(server).toContain(arg);

    const late = viewer();
    android.attach(late.client, { codec: "h264" });
    expect(late.frames).toEqual(expected);
    await android.shutdown();
    scrcpy.server.close();
  });

  test("new settings move open viewers to a new session without closing them", async () => {
    const fakes = fakeAndroid();
    const scrcpy = await fakeScrcpy();
    let settings: Partial<AndroidStreamSettings> = { bitRate: 8_000_000 };
    const android = await screens(fakes, scrcpy.port, {}, () => settings);
    const a = viewer();
    android.attach(a.client, { codec: "h264" });
    await waitFor(() => a.messages.length === 1);
    const servers = () => argv(fakes, "adb").filter((line) => line.includes("scrcpy.Server"));

    settings = { bitRate: 8_000_000, jpegQuality: 20 };
    android.restart();
    expect(servers()).toHaveLength(1);

    settings = { bitRate: 2_000_000 };
    android.restart();
    await waitFor(() => a.messages.length === 2);
    expect(a.messages[1]).toMatchObject({ type: "meta", codec: "h264" });
    expect(servers()).toHaveLength(2);
    expect(servers()[1]).toContain("video_bit_rate=2000000");
    expect(android.viewers).toBe(1);

    settings = { encoding: "mjpeg" };
    android.restart();
    await waitFor(() => a.messages.length === 3);
    expect(a.messages[2]).toMatchObject({ type: "meta", codec: "mjpeg" });
    await android.shutdown();
    scrcpy.server.close();
  });

  test("settings saved by the CLI reach the open screens", async () => {
    const fakes = fakeAndroid();
    const dir = makeTempDir("watch");
    const store = new HostStateStore(dir, join(dir, "state.json"));
    store.ensureToken();
    const host = new HostAndroid(fakes.config, store, { hostId: "h", version: "1" }, silentLogger, { settingsDebounceMs: 20 });
    let restarts = 0;
    host.screens.restart = () => {
      restarts += 1;
    };
    await host.init();
    new HostStateStore(dir, join(dir, "state.json")).updateAndroidStream({ maxFps: 30 });
    await waitFor(() => restarts === 1);
    store.updateAndroidStream({ maxFps: 30 });
    await Bun.sleep(100);
    expect(restarts).toBe(1);
    host.updateStream({ maxFps: 24 });
    expect(restarts).toBe(2);
    await host.shutdown();
  });

  test("a viewer that cannot decode H.264 gets its own JPEG session", async () => {
    const fakes = fakeAndroid();
    const scrcpy = await fakeScrcpy();
    const android = await screens(fakes, scrcpy.port, { jpegQuality: 12 });
    const h264 = viewer();
    const jpeg = viewer();
    android.attach(h264.client, { codec: "h264" });
    await waitFor(() => h264.messages.length > 0);
    android.attach(jpeg.client);
    await waitFor(() => jpeg.messages.length > 0);
    expect(h264.messages[0]).toMatchObject({ type: "meta", codec: "h264" });
    expect(jpeg.messages[0]).toMatchObject({ type: "meta", codec: "mjpeg" });
    expect(argv(fakes, "adb").filter((line) => line.includes("scrcpy.Server"))).toHaveLength(2);
    await android.shutdown();
    scrcpy.server.close();
  });

  test("another adb device streams while the emulator is stopped", async () => {
    const fakes = fakeAndroid();
    const scrcpy = await fakeScrcpy();
    const android = await screens(fakes, scrcpy.port, { device: "192.168.56.101:5555" });
    rmSync(join(fakes.dir, "online"));
    const a = viewer();
    android.attach(a.client, { codec: "h264" });
    await waitFor(() => a.messages.length > 0);
    expect(a.messages[0]).toMatchObject({ type: "meta", codec: "h264" });
    expect(argv(fakes, "adb").find((line) => line.includes("scrcpy.Server"))).toStartWith("-s 192.168.56.101:5555 shell");
    await android.shutdown();
    scrcpy.server.close();
  });

  test("a viewer leaving while the session starts releases the adb forward", async () => {
    const fakes = fakeAndroid();
    const scrcpy = await fakeScrcpy();
    writeFileSync(join(fakes.dir, "forward.delay"), "0.4");
    const android = await screens(fakes, scrcpy.port);
    const detach = android.attach(viewer().client);
    await waitFor(() => argv(fakes, "adb").some((line) => line.includes("forward tcp:0")));
    detach();
    await waitFor(() => argv(fakes, "adb").some((line) => line.includes(`forward --remove tcp:${scrcpy.port}`)));
    await Bun.sleep(100);
    expect(argv(fakes, "adb").some((line) => line.includes("scrcpy.Server"))).toBe(false);
    await android.shutdown();
    scrcpy.server.close();
  });
});

describe("host android API", () => {
  let shell: HostShell | null = null;
  let base = "";
  let token = "";
  let config: HostConfig;

  afterEach(async () => {
    await shell?.stop();
    shell = null;
  });

  async function start(android: AndroidConfig): Promise<string> {
    const dir = makeTempDir("host-android");
    config = { ...loadHostConfig({ HOME: dir, THEONE_HOST_SHELL_DIR: join(dir, "state"), PATH: "" }, { bind: "127.0.0.1", port: "0" }), android };
    const store = new HostStateStore(config.stateDir, config.stateFile);
    await store.setPin(PIN);
    shell = startHostShell(config, { logger: silentLogger, android: { emulator: { bootPollMs: 50, watchMs: 0, stopGraceMs: 2_000 }, link: { reconnectMinMs: 50, reconnectMaxMs: 100 } } });
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

  test("every android route needs a session; the host token alone is not enough", async () => {
    await start(fakeAndroid().config);
    for (const [method, path] of [
      ["GET", "/v1/android"],
      ["POST", "/v1/android/emulator"],
      ["DELETE", "/v1/android/emulator"],
      ["POST", "/v1/android/link"],
      ["DELETE", "/v1/android/link"],
      ["GET", "/v1/android/devices"],
      ["GET", "/v1/android/stream"],
      ["PUT", "/v1/android/stream"],
    ] as const) {
      expect((await call(method, path, null)).status).toBe(401);
      expect((await call(method, path, token)).status).toBe(401);
    }
  });

  test("stream settings are read and changed", async () => {
    const session = await start(fakeAndroid().config);
    expect((await call("GET", "/v1/android/stream", session)).body).toEqual(DEFAULT_ANDROID_STREAM);
    const changed = await call("PUT", "/v1/android/stream", session, { encoding: "mjpeg", maxFps: 30 });
    expect(changed.body).toEqual({ ...DEFAULT_ANDROID_STREAM, encoding: "mjpeg", maxFps: 30 });
    expect((await call("PUT", "/v1/android/stream", session, { bitRate: 10 })).status).toBe(400);
    expect((await call("GET", "/v1/android", session)).body.stream).toEqual(changed.body);
    expect((await call("GET", "/v1/android/devices", session)).status).toBe(200);
  });

  test("status reports missing tools without failing", async () => {
    const session = await start({ ...fakeAndroid().config, sdkRoot: null, emulator: null, adb: null });
    const result = await call("GET", "/v1/android", session);
    expect(result.status).toBe(200);
    expect(HostAndroidStatusSchema.parse(result.body)).toEqual({
      available: false,
      reason: "No Android SDK found; set THEONE_ANDROID_SDK_ROOT",
      sdkRoot: null,
      isolation: "none",
      avds: [],
      scrcpy: false,
      ffmpeg: false,
      emulator: { state: "unavailable", avd: null, serial: null, managed: false, isolated: false, width: null, height: null, startedAt: null, error: null },
      link: { configured: false, sandboxUrl: null, connected: false, lastError: null },
      stream: DEFAULT_ANDROID_STREAM,
      devices: [],
    });
    expect((await call("POST", "/v1/android/emulator", session, { avd: "Pixel_5" })).status).toBe(503);
  });

  test("starts and stops the emulator with the documented status codes", async () => {
    const session = await start(fakeAndroid().config);
    const status = HostAndroidStatusSchema.parse((await call("GET", "/v1/android", session)).body);
    expect(status).toMatchObject({ available: true, reason: null, avds: ["Pixel_5", "Tablet_API_34"], emulator: { state: "stopped" } });

    expect((await call("POST", "/v1/android/emulator", session, { avd: "bad name!" })).status).toBe(400);
    expect((await call("POST", "/v1/android/emulator", session, { avd: "Nexus_9" })).status).toBe(404);
    const started = await call("POST", "/v1/android/emulator", session, { avd: "Pixel_5" });
    expect(started.status).toBe(202);
    expect(EmulatorInfoSchema.parse(started.body).state).toBe("starting");
    expect((await call("POST", "/v1/android/emulator", session, { avd: "Pixel_5" })).status).toBe(409);
    await waitFor(async () => (await call("GET", "/v1/android", session)).body.emulator.state === "running");

    const stopping = await call("DELETE", "/v1/android/emulator", session);
    expect(stopping.status).toBe(200);
    expect((stopping.body as EmulatorInfo).state).toBe("stopping");
    await waitFor(async () => (await call("GET", "/v1/android", session)).body.emulator.state === "stopped");
    expect((await call("PUT", "/v1/android/emulator", session)).status).toBe(405);
  });

  test("the sandbox link is stored 0600 and its token is never returned", async () => {
    const session = await start(fakeAndroid().config);
    expect((await call("POST", "/v1/android/link", session, { sandboxUrl: "ftp://sandbox", token: "t" })).status).toBe(400);
    expect((await call("POST", "/v1/android/link", session, { sandboxUrl: "http://127.0.0.1:9" })).status).toBe(400);

    const linked = await call("POST", "/v1/android/link", session, { sandboxUrl: "http://127.0.0.1:9/", token: "sandbox-secret" });
    expect(linked.status).toBe(200);
    expect(AndroidLinkInfoSchema.parse(linked.body)).toMatchObject({ configured: true, sandboxUrl: "http://127.0.0.1:9", connected: false });
    expect(JSON.stringify(linked.body)).not.toContain("sandbox-secret");
    const saved = JSON.parse(readFileSync(config.stateFile, "utf8"));
    expect(saved.androidLink).toEqual({ sandboxUrl: "http://127.0.0.1:9", token: "sandbox-secret" });
    expect(saved.pinHash).toBeString();
    expect(statSync(config.stateFile).mode & 0o777).toBe(0o600);

    const status = await waitFor(async () => {
      const body = (await call("GET", "/v1/android", session)).body;
      return body.link.lastError ? body : null;
    });
    expect(status.link).toMatchObject({ configured: true, connected: false });
    expect(JSON.stringify(status)).not.toContain("sandbox-secret");

    const unlinked = await call("DELETE", "/v1/android/link", session);
    expect(unlinked.body).toEqual({ configured: false, sandboxUrl: null, connected: false, lastError: null });
    expect(JSON.parse(readFileSync(config.stateFile, "utf8")).androidLink).toBeNull();
  });

  test("the screen socket needs a ticket and reports a stopped emulator", async () => {
    const session = await start(fakeAndroid().config);
    const ws = base.replace(/^http/, "ws");
    const refused = await new Promise<number>((resolve) => {
      const socket = new WebSocket(`${ws}/v1/android/screen?ticket=nope`);
      socket.onerror = () => resolve(-1);
      socket.onopen = () => resolve(0);
    });
    expect(refused).toBe(-1);

    const { ticket } = (await call("POST", "/v1/auth/ticket", session)).body;
    const messages: string[] = [];
    const closed = await new Promise<number>((resolve) => {
      const socket = new WebSocket(`${ws}/v1/android/screen?ticket=${ticket}&maxSize=720`);
      socket.onmessage = (event) => messages.push(String(event.data));
      socket.onclose = (event) => resolve(event.code);
    });
    expect(messages.map((message) => JSON.parse(message))).toEqual([{ type: "error", message: "scrcpy-server is not installed on the host; set THEONE_SCRCPY_SERVER" }]);
    expect(closed).toBe(1000);

    const { ticket: second } = (await call("POST", "/v1/auth/ticket", session)).body;
    const upgrade = await fetch(`${base}/v1/android/screen?ticket=${second}&maxSize=0`, {
      headers: { Upgrade: "websocket", Connection: "Upgrade", "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==", "Sec-WebSocket-Version": "13" },
    });
    expect(upgrade.status).toBe(400);
    const reused = await new Promise<string>((resolve) => {
      const socket = new WebSocket(`${ws}/v1/android/screen?ticket=${second}`);
      socket.onmessage = (event) => resolve(String(event.data));
      socket.onerror = () => resolve("refused");
    });
    expect(JSON.parse(reused).type).toBe("error");
  });

  test("serves the screen page without secrets", async () => {
    await start(fakeAndroid().config);
    const page = await fetch(`${base}/ui/android`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("data-screen");
    expect(html).not.toContain(token);
  });
});
