import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { InstallPlan, PackageProgress, SdkCatalog, SdkPackage, SystemImageOption } from "../../shared/contracts/android";
import { checkEmulatorRequirement, installPackages, orderPackages } from "./installer";
import { installedRevision } from "./sdk";
import { buildZip, serveFiles, sha1, tempDir, testPaths, type FileServer } from "./test-support";
import { child, childText, parseXml } from "./xml";

const ZIPS = {
  "platform-tools.zip": buildZip([
    { name: "platform-tools/" },
    { name: "platform-tools/adb", data: "#!/bin/sh\necho adb\n", mode: 0o100755 },
    { name: "platform-tools/source.properties", data: "Pkg.Revision=37.0.1\n" },
  ]),
  "emulator.zip": buildZip([
    { name: "emulator/" },
    { name: "emulator/emulator", data: "#!/bin/sh\nexit 0\n", mode: 0o100755 },
    { name: "emulator/source.properties", data: "Pkg.Revision=37.2.12\n" },
  ]),
  "x86_64-36_r07.zip": buildZip([
    { name: "x86_64/" },
    { name: "x86_64/system.img", data: "system" },
    { name: "x86_64/build.prop", data: "ro.build.version.sdk=36\n" },
  ]),
};

function pkg(path: string, displayName: string, revision: string, file: keyof typeof ZIPS, base: string, extra: Partial<SdkPackage> = {}): SdkPackage {
  return {
    path,
    displayName,
    revision,
    licenseId: "android-sdk-license",
    dependencies: [],
    archive: { url: `${base}/${file}`, size: ZIPS[file].length, sha1: sha1(ZIPS[file]), hostOs: null, hostArch: null },
    ...extra,
  };
}

function catalog(base: string, emulatorMin = "35.4.9"): SdkCatalog {
  const image: SystemImageOption = {
    ...pkg("system-images;android-36;google_apis;x86_64", "Google APIs Intel x86_64 Atom System Image", "7", "x86_64-36_r07.zip", base, {
      dependencies: [{ path: "emulator", minRevision: emulatorMin }],
    }),
    api: 36,
    versionName: "16",
    abi: "x86_64",
  };
  return {
    fetchedAt: "2026-10-07T00:00:00.000Z",
    emulator: pkg("emulator", "Android Emulator", "37.2.12", "emulator.zip", base),
    platformTools: pkg("platform-tools", "Android SDK Platform-Tools", "37.0.1", "platform-tools.zip", base),
    systemImages: [image],
    licenses: { "android-sdk-license": "Terms and Conditions\n\nline one\nline two" },
  };
}

describe("installPackages", () => {
  let dir = "";
  let cleanup: () => Promise<void> = async () => undefined;
  let server: FileServer;
  let sdk = "";

  beforeEach(async () => {
    ({ dir, cleanup } = await tempDir());
    sdk = join(dir, "sdk");
    server = await serveFiles(ZIPS);
  });
  afterEach(async () => {
    await server.close();
    await cleanup();
  });

  const plan = (avd = false): InstallPlan => ({
    sdkRoot: sdk,
    packages: ["system-images;android-36;google_apis;x86_64", "emulator", "platform-tools"],
    avd: avd
      ? { name: "Monolith_API_36", sdkRoot: sdk, systemImage: "system-images;android-36;google_apis;x86_64", api: 36, abi: "x86_64", ramMb: 2048, cores: 2, deviceProfile: "pixel_5", storageMb: 6144 }
      : null,
  });

  it("downloads, verifies and extracts packages in the sdkmanager layout, then writes the AVD", async () => {
    const progress: PackageProgress[] = [];
    const phases: string[] = [];
    const home = join(dir, "home");
    await installPackages(
      plan(true),
      catalog(server.url),
      { onProgress: (entry) => progress.push(entry), onPhase: (phase) => phases.push(phase) },
      new AbortController().signal,
      { paths: testPaths(home), freeBytes: async () => null, avd: { verify: false } },
    );
    expect(server.requests.map((request) => request.path)).toEqual(["/platform-tools.zip", "/emulator.zip", "/x86_64-36_r07.zip"]);
    expect(phases).toEqual(["installing", "creating-avd"]);
    if (process.platform !== "win32") expect((await stat(join(sdk, "platform-tools", "adb"))).mode & 0o777).toBe(0o755);
    expect(await readFile(join(sdk, "system-images", "android-36", "google_apis", "x86_64", "system.img"), "utf8")).toBe("system");
    expect(await installedRevision(sdk, "emulator")).toBe("37.2.12");
    expect(await installedRevision(sdk, "system-images;android-36;google_apis;x86_64")).toBe("7");
    const imageXml = parseXml(await readFile(join(sdk, "system-images", "android-36", "google_apis", "x86_64", "package.xml"), "utf8"));
    expect(child(imageXml, "license")?.attrs.id).toBe("android-sdk-license");
    const local = child(imageXml, "localPackage")!;
    expect(local.attrs.path).toBe("system-images;android-36;google_apis;x86_64");
    expect(child(local, "type-details")?.attrs.type).toBe("ns13:sysImgDetailsType");
    expect(childText(child(local, "type-details")!, "api-level")).toBe("36");
    expect(child(child(local, "dependencies")!, "dependency")?.attrs.path).toBe("emulator");
    expect(await readdir(join(sdk, ".temp"))).toEqual([]);
    const stages = progress.map((entry) => `${entry.index}/${entry.count}:${entry.pkg}:${entry.stage}`);
    expect(stages[0]).toBe("0/3:platform-tools:downloading");
    expect(stages).toContain("1/3:emulator:verifying");
    expect(stages.at(-1)).toBe("2/3:system-images;android-36;google_apis;x86_64:extracting");
    expect(await readFile(join(home, ".android", "avd", "Monolith_API_36.ini"), "utf8")).toContain("target=android-36");
  });

  it("skips packages that are already installed", async () => {
    const options = { paths: testPaths(join(dir, "home")), freeBytes: async () => null };
    await installPackages(plan(), catalog(server.url), {}, new AbortController().signal, options);
    const logs: string[] = [];
    await installPackages(plan(), catalog(server.url), { onLog: (line) => logs.push(line) }, new AbortController().signal, options);
    expect(server.requests).toHaveLength(3);
    expect(logs).toContain("emulator 37.2.12 is already installed");
  });

  it("refuses when the disk is too small", async () => {
    await expect(
      installPackages(plan(), catalog(server.url), {}, new AbortController().signal, { freeBytes: async () => 10 }),
    ).rejects.toThrow(`Only 0.0 GB free in ${sdk}`);
  });

  it("refuses a system image that needs a newer emulator", async () => {
    const onlyImage: InstallPlan = { sdkRoot: sdk, packages: ["system-images;android-36;google_apis;x86_64"], avd: null };
    await expect(
      installPackages(onlyImage, catalog(server.url), {}, new AbortController().signal, { freeBytes: async () => null }),
    ).rejects.toThrow("This system image needs emulator 35.4.9 or newer");
    expect(() => checkEmulatorRequirement([{ pkg: catalog(server.url, "99").systemImages[0]!, installed: null }], "37.2.12")).toThrow(
      "This system image needs emulator 99 or newer",
    );
  });

  it("rejects unknown packages", async () => {
    await expect(
      installPackages({ sdkRoot: sdk, packages: ["ndk;27"], avd: null }, catalog(server.url), {}, new AbortController().signal),
    ).rejects.toMatchObject({ code: "invalid_argument" });
  });

  it("orders platform-tools, emulator, then system images", () => {
    expect(orderPackages([{ path: "system-images;a" }, { path: "other" }, { path: "emulator" }, { path: "platform-tools" }]).map((p) => p.path)).toEqual([
      "platform-tools",
      "emulator",
      "system-images;a",
      "other",
    ]);
  });
});
