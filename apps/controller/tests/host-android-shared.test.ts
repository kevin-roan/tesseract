import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { emulatorConsolePort, sharedEmulatorTunnelPort, type AndroidDevice, type SharedEmulator } from "@tesseract/protocol";
import { silentLogger } from "../src/core/logger";
import type { AndroidConfig } from "../src/host/android/config";
import { SharedEmulators, shareableEmulators } from "../src/host/android/shared";
import { makeTempDir, removeTempDirs, waitFor } from "./helpers";

const device = (serial: string, state = "device", model: string | null = null): AndroidDevice => ({ serial, state, kind: "emulator", model, hostEmulator: false });

/** A host adb whose `adb devices -l` prints `devices.txt` next to it. */
function fakeAdb(): { dir: string; config: AndroidConfig; devices: (lines: string[]) => void } {
  const dir = makeTempDir("android-shared");
  const adb = join(dir, "adb");
  writeFileSync(adb, `#!/usr/bin/env bash\necho "List of devices attached"\ncat "${dir}/devices.txt" 2>/dev/null\n`);
  chmodSync(adb, 0o755);
  const config: AndroidConfig = {
    sdkRoot: null,
    emulator: null,
    adb,
    scrcpyServer: null,
    scrcpyVersion: null,
    ffmpeg: null,
    emulatorPort: 5554,
    gpu: "swiftshader_indirect",
    isolation: "netns",
    unshare: null,
    ip: null,
    allowNets: [],
    adbBridgePort: null,
    shareEmulators: true,
    runtimeDir: join(dir, "run"),
  };
  return { dir, config, devices: (lines) => writeFileSync(join(dir, "devices.txt"), lines.map((line) => `${line}\n`).join("")) };
}

const started: SharedEmulators[] = [];
afterEach(() => {
  for (const shared of started.splice(0)) shared.stop();
});
afterAll(() => removeTempDirs());

describe("shared emulator serials and ports", () => {
  test("only even console ports 5554-5682 are emulator serials", () => {
    expect(emulatorConsolePort("emulator-5554")).toBe(5554);
    expect(emulatorConsolePort("emulator-5682")).toBe(5682);
    expect(emulatorConsolePort("emulator-5555")).toBeNull();
    expect(emulatorConsolePort("emulator-5684")).toBeNull();
    expect(emulatorConsolePort("127.0.0.1:5555")).toBeNull();
    expect(emulatorConsolePort("R58M123ABC")).toBeNull();
  });

  test("each console port gets its own sandbox port after the host emulator's tunnel", () => {
    expect(sharedEmulatorTunnelPort(15555, "emulator-5554")).toBe(15556);
    expect(sharedEmulatorTunnelPort(15555, "emulator-5556")).toBe(15557);
    expect(sharedEmulatorTunnelPort(15555, "emulator-5682")).toBe(15620);
    expect(sharedEmulatorTunnelPort(15555, "R58M123ABC")).toBeNull();
  });

  test("shares online emulators only, never USB or network devices, nor the excluded one", () => {
    const devices = [
      device("emulator-5558", "device", "Pixel 9"),
      device("emulator-5554"),
      device("emulator-5556", "offline"),
      device("R58M123ABC"),
      device("192.168.1.20:5555"),
      device("127.0.0.1:41555"),
    ];
    expect(shareableEmulators(devices, null)).toEqual([
      { serial: "emulator-5554", model: null },
      { serial: "emulator-5558", model: "Pixel 9" },
    ]);
    expect(shareableEmulators(devices, "emulator-5554")).toEqual([{ serial: "emulator-5558", model: "Pixel 9" }]);
  });
});

describe("shared emulators", () => {
  test("follows the host adb and reaches each emulator's adbd on console port + 1", async () => {
    const fakes = fakeAdb();
    fakes.devices(["emulator-5556\tdevice product:sdk_gphone64 model:Pixel_9 device:emu64", "R58M123ABC\tdevice usb:1-1 model:SM_G991B"]);
    const shared = new SharedEmulators(fakes.config, () => null, silentLogger, { pollMs: 50 });
    started.push(shared);
    const changes: SharedEmulator[][] = [];
    shared.onChange((devices) => changes.push(devices));
    await shared.start();
    expect(shared.list()).toEqual([{ serial: "emulator-5556", model: "Pixel 9" }]);
    expect(shared.endpoint("emulator-5556")).toEqual({ host: "127.0.0.1", port: 5557 });
    expect(shared.endpoint("emulator-5558")).toBeNull();
    expect(shared.endpoint("R58M123ABC")).toBeNull();

    fakes.devices([]);
    await waitFor(() => changes.length === 2);
    expect(changes[1]).toEqual([]);
    expect(shared.endpoint("emulator-5556")).toBeNull();
  });

  test("shares nothing while TESSERACT_ANDROID_SHARE_EMULATORS is off", async () => {
    const fakes = fakeAdb();
    fakes.devices(["emulator-5556\tdevice"]);
    const shared = new SharedEmulators({ ...fakes.config, shareEmulators: false }, () => null, silentLogger, { pollMs: 50 });
    started.push(shared);
    await shared.start();
    await shared.refresh();
    expect(shared.enabled).toBe(false);
    expect(shared.list()).toEqual([]);
    expect(shared.endpoint("emulator-5556")).toBeNull();
  });
});
