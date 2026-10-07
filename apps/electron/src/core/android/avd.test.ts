import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AvdDeviceProfile, AvdSpec } from "../../shared/contracts/android";
import { IpcError } from "../../shared/ipc-types";
import { avdHome, dataPartitionSize, defaultAvdName, defaultAvdResources, deleteAvd, DEVICE_PROFILES, listAvds, validateAvdSpec, writeAvd } from "./avd";
import { GIGABYTE } from "./constants";
import { tempDir, testPaths } from "./test-support";

const EXPECTED_CONFIG = `AvdId=Monolith_API_36
PlayStore.enabled=false
abi.type=x86_64
avd.ini.displayname=Monolith API 36
avd.ini.encoding=UTF-8
disk.dataPartition.size=6G
fastboot.forceColdBoot=no
fastboot.forceFastBoot=yes
hw.accelerometer=yes
hw.audioInput=no
hw.battery=yes
hw.camera.back=none
hw.camera.front=none
hw.cpu.arch=x86_64
hw.cpu.ncore=4
hw.dPad=no
hw.device.manufacturer=Google
hw.device.name=pixel_5
hw.gps=yes
hw.gpu.enabled=yes
hw.gpu.mode=swiftshader_indirect
hw.keyboard=yes
hw.lcd.density=440
hw.lcd.height=2340
hw.lcd.width=1080
hw.mainKeys=no
hw.ramSize=2048
hw.sdCard=no
hw.trackBall=no
image.sysdir.1=system-images/android-36/google_apis/x86_64/
runtime.network.latency=none
runtime.network.speed=full
showDeviceFrame=no
skin.dynamic=yes
skin.name=1080x2340
skin.path=_no_skin
tag.display=Google APIs
tag.id=google_apis
target=android-36
vm.heapSize=256
`;

const PROFILE_KEYS: Record<AvdDeviceProfile, Record<string, string>> = {
  pixel_5: { "hw.device.manufacturer": "Google", "hw.lcd.width": "1080", "hw.lcd.height": "2340", "hw.lcd.density": "440", "skin.name": "1080x2340" },
  pixel_8: { "hw.device.manufacturer": "Google", "hw.lcd.width": "1080", "hw.lcd.height": "2400", "hw.lcd.density": "420", "skin.name": "1080x2400" },
  medium_phone: { "hw.device.manufacturer": "Generic", "hw.lcd.width": "1080", "hw.lcd.height": "2400", "hw.lcd.density": "420", "skin.name": "1080x2400" },
  pixel_tablet: { "hw.device.manufacturer": "Google", "hw.lcd.width": "2560", "hw.lcd.height": "1600", "hw.lcd.density": "320", "skin.name": "2560x1600" },
};

function configLines(text: string): Record<string, string> {
  return Object.fromEntries(text.trim().split("\n").map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
}

describe("AVD writer", () => {
  let dir = "";
  let cleanup: () => Promise<void> = async () => undefined;
  let sdk = "";
  let home = "";

  const spec = (overrides: Partial<AvdSpec> = {}): AvdSpec => ({
    name: "Monolith_API_36",
    sdkRoot: sdk,
    systemImage: "system-images;android-36;google_apis;x86_64",
    api: 36,
    abi: "x86_64",
    ramMb: 2048,
    cores: 4,
    deviceProfile: "pixel_5",
    storageMb: 6144,
    ...overrides,
  });

  beforeEach(async () => {
    ({ dir, cleanup } = await tempDir());
    sdk = join(dir, "sdk");
    home = join(dir, "home");
    await mkdir(join(sdk, "system-images", "android-36", "google_apis", "x86_64"), { recursive: true });
    await mkdir(join(sdk, "system-images", "android-36.1", "google_apis", "arm64-v8a"), { recursive: true });
  });
  afterEach(() => cleanup());

  it("resolves the AVD home like the emulator", () => {
    expect(avdHome(testPaths(home))).toBe(join(home, ".android", "avd"));
    expect(avdHome(testPaths(home, { ANDROID_USER_HOME: "/u" }))).toBe(join("/u", "avd"));
    expect(avdHome(testPaths(home, { ANDROID_USER_HOME: "/u", ANDROID_AVD_HOME: "/a" }))).toBe("/a");
  });

  it("writes <name>.ini and config.ini exactly", async () => {
    const paths = testPaths(home);
    const info = await writeAvd(paths, spec());
    const avdDir = join(home, ".android", "avd", "Monolith_API_36.avd");
    expect(info).toEqual({ name: "Monolith_API_36", path: avdDir, target: "android-36", abi: "x86_64" });
    expect(await readFile(join(home, ".android", "avd", "Monolith_API_36.ini"), "utf8")).toBe(
      `avd.ini.encoding=UTF-8\npath=${avdDir}\npath.rel=avd/Monolith_API_36.avd\ntarget=android-36\n`,
    );
    expect(await readFile(join(avdDir, "config.ini"), "utf8")).toBe(EXPECTED_CONFIG);
  });

  it("covers every device profile offered in the UI", () => {
    expect([...DEVICE_PROFILES].sort()).toEqual(Object.keys(PROFILE_KEYS).sort());
  });

  it.each(Object.entries(PROFILE_KEYS) as [AvdDeviceProfile, Record<string, string>][])("writes the %s profile", async (profile, keys) => {
    const paths = testPaths(home);
    const name = `Device_${profile}`;
    await writeAvd(paths, spec({ name, deviceProfile: profile, storageMb: 8192, ramMb: 3072, cores: 2 }));
    const text = await readFile(join(home, ".android", "avd", `${name}.avd`, "config.ini"), "utf8");
    const config = configLines(text);
    expect(config).toMatchObject({
      ...keys,
      "hw.device.name": profile,
      "disk.dataPartition.size": "8G",
      "hw.ramSize": "3072",
      "hw.cpu.ncore": "2",
      "skin.path": "_no_skin",
    });
    expect(Object.keys(config)).toEqual(Object.keys(configLines(EXPECTED_CONFIG)));
  });

  it("formats the data partition size", () => {
    expect(dataPartitionSize(6144)).toBe("6G");
    expect(dataPartitionSize(2560)).toBe("2560M");
  });

  it("rejects malformed specs before touching the disk", () => {
    expect(() => validateAvdSpec(null)).toThrow(IpcError);
    expect(() => validateAvdSpec({ ...spec(), deviceProfile: "nexus_one" })).toThrow("Unknown device profile nexus_one");
    expect(() => validateAvdSpec({ ...spec(), deviceProfile: "__proto__" })).toThrow("Unknown device profile");
    expect(() => validateAvdSpec({ ...spec(), storageMb: 1024 })).toThrow("Internal storage must be between 2 and 64 GB");
    expect(() => validateAvdSpec({ ...spec(), storageMb: 70 * 1024 })).toThrow(IpcError);
    expect(() => validateAvdSpec({ ...spec(), storageMb: "6G" })).toThrow("invalid storageMb");
    expect(() => validateAvdSpec({ ...spec(), ramMb: 9000 })).toThrow("Memory must be between");
    expect(() => validateAvdSpec({ ...spec(), cores: 1.5 })).toThrow("invalid cores");
    expect(() => validateAvdSpec({ ...spec(), sdkRoot: 7 })).toThrow("invalid sdkRoot");
    expect(() => validateAvdSpec({ ...spec(), abi: "arm64-v8a" })).toThrow("isn't a Google APIs system image");
    expect(() => validateAvdSpec(spec())).not.toThrow();
  });

  it("uses the image's platform segment for minor releases and arm64", async () => {
    const paths = testPaths(home);
    await writeAvd(paths, spec({ name: "Arm", systemImage: "system-images;android-36.1;google_apis;arm64-v8a", api: 36.1, abi: "arm64-v8a" }));
    const config = await readFile(join(home, ".android", "avd", "Arm.avd", "config.ini"), "utf8");
    expect(config).toContain("image.sysdir.1=system-images/android-36.1/google_apis/arm64-v8a/\n");
    expect(config).toContain("hw.cpu.arch=arm64\n");
    expect(config).toContain("target=android-36.1\n");
  });

  it("validates names, duplicates, resources and the installed image", async () => {
    const paths = testPaths(home);
    await expect(writeAvd(paths, spec({ name: "bad name" }))).rejects.toMatchObject({ code: "invalid_argument" });
    await expect(writeAvd(paths, spec({ name: ".." }))).rejects.toBeInstanceOf(IpcError);
    await expect(writeAvd(paths, spec({ ramMb: 512 }))).rejects.toMatchObject({ code: "invalid_argument" });
    await expect(writeAvd(paths, spec({ storageMb: 512 }))).rejects.toMatchObject({ code: "invalid_argument" });
    await expect(writeAvd(paths, spec({ deviceProfile: "nexus" as AvdDeviceProfile }))).rejects.toMatchObject({ code: "invalid_argument" });
    await expect(writeAvd(paths, spec({ systemImage: "system-images;android-35;google_apis;x86_64" }))).rejects.toMatchObject({
      code: "not_found",
    });
    await writeAvd(paths, spec());
    await expect(writeAvd(paths, spec())).rejects.toThrow("An AVD named Monolith_API_36 already exists");
  });

  it("removes the files when the emulator doesn't list the new AVD", async () => {
    const paths = testPaths(home);
    await expect(writeAvd(paths, spec(), { listAvds: async () => ["Other"] })).rejects.toThrow(
      "The emulator doesn't see the new virtual device Monolith_API_36",
    );
    expect(await listAvds(paths, sdk)).toEqual([]);
    await writeAvd(paths, spec(), { listAvds: async () => ["Monolith_API_36"] });
    expect((await listAvds(paths, sdk)).map((avd) => avd.name)).toEqual(["Monolith_API_36"]);
  });

  it("lists AVDs written by Android Studio and deletes them", async () => {
    const paths = testPaths(home);
    const avdDir = join(home, ".android", "avd");
    await mkdir(join(avdDir, "Pixel_5.avd"), { recursive: true });
    await writeFile(join(avdDir, "Pixel_5.ini"), `avd.ini.encoding=UTF-8\npath=${join(avdDir, "Pixel_5.avd")}\npath.rel=avd/Pixel_5.avd\ntarget=android-34\n`);
    await writeFile(join(avdDir, "Pixel_5.avd", "config.ini"), "abi.type=arm64-v8a\n");
    await writeAvd(paths, spec());
    expect(await listAvds(paths, sdk)).toEqual([
      { name: "Monolith_API_36", path: join(avdDir, "Monolith_API_36.avd"), target: "android-36", abi: "x86_64" },
      { name: "Pixel_5", path: join(avdDir, "Pixel_5.avd"), target: "android-34", abi: "arm64-v8a" },
    ]);
    await deleteAvd(paths, sdk, "Pixel_5");
    expect((await listAvds(paths, sdk)).map((avd) => avd.name)).toEqual(["Monolith_API_36"]);
    await expect(deleteAvd(paths, sdk, "Pixel_5")).rejects.toMatchObject({ code: "not_found" });
    await expect(deleteAvd(paths, sdk, "../x")).rejects.toMatchObject({ code: "invalid_argument" });
  });

  it("does not delete outside the AVD home when the .ini points elsewhere", async () => {
    const paths = testPaths(home);
    const outside = join(dir, "outside", "Evil.avd");
    await mkdir(outside, { recursive: true });
    await mkdir(join(home, ".android", "avd"), { recursive: true });
    await writeFile(join(home, ".android", "avd", "Evil.ini"), `path=${outside}\n`);
    await deleteAvd(paths, sdk, "Evil");
    expect((await readFile(join(home, ".android", "avd", "Evil.ini")).catch(() => null))).toBeNull();
    expect((await stat(outside)).isDirectory()).toBe(true);
  });

  it("computes the default name and resources", () => {
    expect(defaultAvdName(36)).toBe("Monolith_API_36");
    expect(defaultAvdResources(8 * GIGABYTE, 8)).toEqual({ ramMb: 2048, cores: 4 });
    expect(defaultAvdResources(32 * GIGABYTE, 2)).toEqual({ ramMb: 4096, cores: 2 });
    expect(defaultAvdResources(16 * GIGABYTE, 6)).toEqual({ ramMb: 4096, cores: 3 });
  });
});
