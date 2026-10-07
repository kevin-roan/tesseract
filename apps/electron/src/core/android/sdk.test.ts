import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hostDaemonAndroidEnv, readAndroidConfig, saveAndroidConfig, withAndroidConfig } from "./config";
import { findSdkCandidates, installedRevision, packageDir, parseProperties, preferredSdk } from "./sdk";
import { hostSupport } from "./support";
import { tempDir, testPaths } from "./test-support";

async function fakeSdk(root: string, emulator: string | null, images: string[] = []): Promise<void> {
  await mkdir(join(root, "platform-tools"), { recursive: true });
  if (emulator) {
    await mkdir(join(root, "emulator"), { recursive: true });
    await writeFile(join(root, "emulator", "emulator"), "");
    await writeFile(join(root, "emulator", "source.properties"), `Pkg.Desc=Android Emulator\nPkg.Revision=${emulator}\n`);
  }
  for (const image of images) await mkdir(packageDir(root, image), { recursive: true });
}

describe("SDK discovery", () => {
  let dir = "";
  let cleanup: () => Promise<void> = async () => undefined;

  beforeEach(async () => {
    ({ dir, cleanup } = await tempDir());
  });
  afterEach(() => cleanup());

  it("lists env and Studio SDKs before the Monolith default, deduplicated", async () => {
    const home = join(dir, "home");
    const studio = join(home, "Android", "Sdk");
    const custom = join(dir, "custom");
    await fakeSdk(studio, "37.2.12", ["system-images;android-36;google_apis;x86_64", "system-images;android-35;google_apis;x86_64"]);
    await fakeSdk(custom, null);
    const paths = testPaths(home, { ANDROID_HOME: custom, ANDROID_SDK_ROOT: studio, THEONE_ANDROID_SDK_ROOT: join(dir, "missing") });
    const candidates = await findSdkCandidates(paths);
    expect(candidates).toEqual([
      { path: studio, source: "ANDROID_SDK_ROOT", emulatorRevision: "37.2.12", systemImages: 2 },
      { path: custom, source: "ANDROID_HOME", emulatorRevision: null, systemImages: 0 },
      { path: join(home, ".local", "share", "theone", "android-sdk"), source: "monolith-default", emulatorRevision: null, systemImages: 0 },
    ]);
    expect(preferredSdk(candidates)?.path).toBe(studio);
  });

  it("prefers an existing ANDROID_HOME without an emulator over a fresh SDK", async () => {
    const home = join(dir, "home");
    const custom = join(dir, "custom");
    await fakeSdk(custom, null);
    const candidates = await findSdkCandidates(testPaths(home, { ANDROID_HOME: custom }));
    expect(preferredSdk(candidates)?.source).toBe("ANDROID_HOME");
  });

  it("reads installed revisions from package.xml or source.properties", async () => {
    const root = join(dir, "sdk");
    await fakeSdk(root, "36.1.2");
    expect(await installedRevision(root, "emulator")).toBe("36.1.2");
    await mkdir(join(root, "system-images", "android-36", "google_apis", "x86_64"), { recursive: true });
    await writeFile(
      join(root, "system-images", "android-36", "google_apis", "x86_64", "package.xml"),
      `<?xml version="1.0"?><ns2:repository xmlns:ns2="x"><localPackage path="system-images;android-36;google_apis;x86_64"><revision><major>7</major></revision></localPackage></ns2:repository>`,
    );
    expect(await installedRevision(root, "system-images;android-36;google_apis;x86_64")).toBe("7");
    expect(await installedRevision(root, "platform-tools")).toBeNull();
  });

  it("parses Java properties", () => {
    expect(parseProperties("# c\nPkg.Revision = 1.2.3\nPath:C\\:\\\\x\n")).toEqual({ "Pkg.Revision": "1.2.3", Path: "C:\\x" });
  });
});

describe("hostSupport", () => {
  it("matches the published emulator hosts", () => {
    expect(hostSupport(testPaths("/home/u"), "x64")).toMatchObject({ supported: true, hostOs: "linux", abi: "x86_64", acceleration: "kvm", canLinkSandbox: true });
    expect(hostSupport(testPaths("/home/u"), "arm64")).toEqual({ supported: false, reason: "Google doesn't publish the Android emulator for Linux on ARM." });
    expect(hostSupport(testPaths("/Users/u", {}, "darwin"), "arm64")).toMatchObject({ hostArch: "aarch64", abi: "arm64-v8a", acceleration: "hvf", canLinkSandbox: true });
    expect(hostSupport(testPaths("/Users/u", {}, "darwin"), "x64")).toMatchObject({ hostArch: "x64", abi: "x86_64" });
    expect(hostSupport(testPaths("C:\\Users\\u", {}, "win32"), "x64")).toMatchObject({ hostOs: "windows", acceleration: "whpx" });
    expect(hostSupport(testPaths("C:\\Users\\u", {}, "win32"), "arm64")).toMatchObject({ supported: false });
  });
});

describe("android config", () => {
  let dir = "";
  let cleanup: () => Promise<void> = async () => undefined;

  beforeEach(async () => {
    ({ dir, cleanup } = await tempDir());
  });
  afterEach(() => cleanup());

  it("stores only a non-default SDK root and the AVD, keeping other keys", async () => {
    const home = join(dir, "home");
    const paths = testPaths(home);
    const file = join(dir, "config.json");
    await writeFile(file, JSON.stringify({ url: "http://x", androidSdkRoot: "/old" }));
    expect(await saveAndroidConfig(file, paths, { sdkRoot: join(home, ".local", "share", "theone", "android-sdk"), avd: "Monolith_API_36" })).toEqual({
      sdkRoot: null,
      avd: "Monolith_API_36",
    });
    expect(await readAndroidConfig(file)).toEqual({ sdkRoot: null, avd: "Monolith_API_36" });
    expect(withAndroidConfig({ url: "u" }, paths, { sdkRoot: "/custom" })).toEqual({ url: "u", androidSdkRoot: "/custom" });
  });

  it("builds the host daemon environment", () => {
    expect(hostDaemonAndroidEnv(testPaths("/home/u"), "/sdk")).toEqual({ THEONE_ANDROID_SDK_ROOT: "/sdk", THEONE_ADB: join("/sdk", "platform-tools", "adb") });
    expect(hostDaemonAndroidEnv(testPaths("C:\\Users\\u", {}, "win32"), "C:\\sdk").THEONE_ADB).toMatch(/adb\.exe$/);
  });
});
