import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SdkCatalog, SdkPackage, SystemImageOption } from "../../src/shared/contracts/android";
import { runCli, tempSandbox, type Sandbox } from "../testing";
import { avdInvocation, describeAvds, resolveInstallTargets, resolveSystemImage, systemImageCandidates } from "./android";

function pkg(path: string): SdkPackage {
  return {
    path,
    displayName: path,
    revision: "1.0.0",
    licenseId: "android-sdk-license",
    dependencies: [],
    archive: { url: `https://dl.google.com/${path}.zip`, size: 1024, sha1: "0".repeat(40), hostOs: "linux", hostArch: "x64" },
  };
}

function image(api: number): SystemImageOption {
  return { ...pkg(`system-images;android-${api};google_apis;x86_64`), api, versionName: String(api - 20), abi: "x86_64" };
}

const CATALOG: SdkCatalog = {
  fetchedAt: "2026-10-01T00:00:00.000Z",
  emulator: pkg("emulator"),
  platformTools: pkg("platform-tools"),
  systemImages: [image(36), image(35), image(34)],
  licenses: { "android-sdk-license": "Terms" },
};

describe("install targets", () => {
  it("maps API levels to system images and adds the emulator tools", () => {
    expect(resolveInstallTargets(["35"], CATALOG)).toEqual([
      "system-images;android-35;google_apis;x86_64",
      "emulator",
      "platform-tools",
    ]);
  });

  it("accepts package paths and de-duplicates", () => {
    expect(resolveInstallTargets(["emulator", "emulator"], CATALOG)).toEqual(["emulator"]);
    expect(resolveInstallTargets(["system-images;android-34;google_apis;x86_64", "36"], CATALOG)).toHaveLength(4);
  });

  it("rejects unknown packages", () => {
    expect(() => resolveInstallTargets(["21"], CATALOG)).toThrow(/unknown package or API level: 21/);
    expect(() => resolveInstallTargets(["ndk;27"], CATALOG)).toThrow(/ndk;27/);
  });
});

describe("avd arguments", () => {
  it("supports avd subcommands and top-level aliases", () => {
    expect(avdInvocation(["avd", "create", "Pixel"])).toEqual({ action: "create", name: "Pixel" });
    expect(avdInvocation(["avd"])).toEqual({ action: "list", name: undefined });
    expect(avdInvocation(["list"])).toEqual({ action: "list", name: undefined });
    expect(avdInvocation(["start", "Pixel"])).toEqual({ action: "start", name: "Pixel" });
    expect(avdInvocation(["avds"])).toEqual({ action: "list", name: undefined });
    expect(avdInvocation([])).toEqual({ action: "list", name: undefined });
  });

  it("builds system image paths from API levels", () => {
    expect(systemImageCandidates("36", "arm64-v8a")).toEqual([
      "system-images;android-36;google_apis;arm64-v8a",
      "system-images;android-36.0;google_apis;arm64-v8a",
    ]);
    expect(systemImageCandidates("36.1", "x86_64")).toEqual(["system-images;android-36.1;google_apis;x86_64"]);
    expect(systemImageCandidates("system-images;android-35;google_apis;x86_64", "x86_64")).toEqual([
      "system-images;android-35;google_apis;x86_64",
    ]);
  });

  it("marks the default AVD", () => {
    const lines = describeAvds([{ name: "Pixel", path: "/avd/Pixel.avd", target: "android-36", abi: "x86_64" }], "Pixel");
    expect(lines[1]).toMatch(/^\*\s+Pixel\s+android-36\s+x86_64\s+\/avd\/Pixel.avd$/);
    expect(describeAvds([], null)).toEqual(["No AVDs yet; run tesseract android avd create"]);
  });
});

describe("tesseract android avd", () => {
  let sandbox: Sandbox;
  let sdkRoot: string;

  beforeEach(() => {
    sandbox = tempSandbox();
    sdkRoot = join(sandbox.root, "sdk");
  });

  afterEach(() => sandbox.cleanup());

  it("explains how to install a missing system image", async () => {
    const result = await runCli(sandbox, ["android", "avd", "create", "--sdk", sdkRoot, "--image", "35"]);
    expect(result.code).toBe(1);
    expect(result.err[0]).toContain("run tesseract android install 35");
  });

  it("prefers the installed platform directory for an API level", async () => {
    mkdirSync(join(sdkRoot, "system-images", "android-37.0", "google_apis", "x86_64"), { recursive: true });
    expect(await resolveSystemImage(sdkRoot, "37", "x86_64")).toBe("system-images;android-37.0;google_apis;x86_64");
    expect(await resolveSystemImage(sdkRoot, "35", "x86_64")).toBe("system-images;android-35;google_apis;x86_64");
  });

  it("creates, lists and deletes an AVD and remembers it as the default", async () => {
    mkdirSync(join(sdkRoot, "system-images", "android-35", "google_apis", "x86_64"), { recursive: true });
    const created = await runCli(sandbox, ["android", "avd", "create", "--sdk", sdkRoot, "--image", "35", "--ram", "2048", "--cores", "2", "--json"]);
    expect(created.code).toBe(0);
    expect(JSON.parse(created.out.join("\n"))).toMatchObject({ name: "Monolith_API_35", target: "android-35", abi: "x86_64" });
    expect(JSON.parse(readFileSync(sandbox.configFile, "utf8"))).toEqual({ androidAvd: "Monolith_API_35", androidSdkRoot: sdkRoot });

    const listed = await runCli(sandbox, ["android", "list", "--json"]);
    expect(JSON.parse(listed.out.join("\n"))).toMatchObject({ default: "Monolith_API_35", avds: [{ name: "Monolith_API_35" }] });

    expect((await runCli(sandbox, ["android", "avd", "delete", "Monolith_API_35"])).code).toBe(0);
    expect(JSON.parse(readFileSync(sandbox.configFile, "utf8"))).toEqual({ androidSdkRoot: sdkRoot });
  });

  it("lists AVDs for a bare tesseract android and tesseract android avd", async () => {
    for (const argv of [["android"], ["android", "avd"]]) {
      const result = await runCli(sandbox, argv);
      expect(result.code).toBe(0);
      expect(result.out).toEqual(["No AVDs yet; run tesseract android avd create"]);
    }
    const json = await runCli(sandbox, ["android", "--json"]);
    expect(JSON.parse(json.out.join("\n"))).toEqual({ default: null, avds: [] });
  });

  it("writes the device profile, storage and memory flags", async () => {
    mkdirSync(join(sdkRoot, "system-images", "android-35", "google_apis", "x86_64"), { recursive: true });
    const argv = ["android", "avd", "create", "Tab", "--sdk", sdkRoot, "--image", "35", "--device", "pixel_tablet", "--storage", "16", "--ram", "3072"];
    expect((await runCli(sandbox, argv)).code).toBe(0);
    const config = readFileSync(join(sandbox.root, "avd", "Tab.avd", "config.ini"), "utf8");
    for (const line of ["hw.device.name=pixel_tablet", "hw.lcd.width=2560", "hw.lcd.height=1600", "hw.lcd.density=320", "disk.dataPartition.size=16G", "hw.ramSize=3072"]) {
      expect(config).toContain(`${line}\n`);
    }
  });

  it("rejects bad resource flags", async () => {
    const result = await runCli(sandbox, ["android", "avd", "create", "--ram", "lots"]);
    expect(result.code).toBe(64);
    expect((await runCli(sandbox, ["android", "avd", "create", "--storage", "big"])).code).toBe(64);
    mkdirSync(join(sdkRoot, "system-images", "android-35", "google_apis", "x86_64"), { recursive: true });
    const device = await runCli(sandbox, ["android", "avd", "create", "--sdk", sdkRoot, "--image", "35", "--device", "nexus_one"]);
    expect(device.code).toBe(1);
    expect(device.err[0]).toContain("Unknown device profile nexus_one");
    const storage = await runCli(sandbox, ["android", "avd", "create", "--sdk", sdkRoot, "--image", "35", "--storage", "128"]);
    expect(storage.err[0]).toContain("Internal storage must be between 2 and 64 GB");
  });

  it("fails clearly when there is no AVD to start", async () => {
    const result = await runCli(sandbox, ["android", "avd", "start", "--detach"]);
    expect(result.code).toBe(1);
    expect(result.err[0]).toContain("tesseract android avd create");
  });
});
