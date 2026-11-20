import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { IosConfig } from "../src/host/ios/config";
import type { CommandRunner } from "../src/host/ios/runner";
import { approveUrlScheme, schemeApprovalPath, stringPlist } from "../src/host/ios/scheme-approval";

const UDID = "21227AD4-3397-4FA0-B700-C8DE8B927FDA";
const KEY = "com.apple.CoreSimulator.CoreSimulatorBridge-->exp";
const homes: string[] = [];

const config = (platform: NodeJS.Platform = "darwin"): IosConfig => ({
  enabled: true,
  platform,
  xcrun: "/usr/bin/xcrun",
  idb: null,
  idbCompanion: null,
  ffmpeg: null,
  simcap: null,
  env: { PATH: "/usr/bin:/bin" },
});

function home(): string {
  const dir = mkdtempSync(join(tmpdir(), "scheme-approval-"));
  homes.push(dir);
  return dir;
}

/** Fake `plutil -convert json`: the test plists are XML written by `stringPlist`, so parse those back. */
const plutil: CommandRunner = async (cmd) => {
  const path = cmd.at(-1) ?? "";
  const entries: Record<string, string> = {};
  for (const [, key, value] of readFileSync(path, "utf8").matchAll(/<key>(.*?)<\/key>\s*<string>(.*?)<\/string>/g)) entries[key!.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&")] = value!;
  return { ok: true, code: 0, stdout: JSON.stringify(entries), stderr: "", timedOut: false, error: null };
};

afterEach(() => {
  for (const dir of homes.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("approveUrlScheme", () => {
  test("approves exp:// for Expo Go in the device's scheme approval plist", async () => {
    const dir = home();
    await approveUrlScheme(config(), plutil, UDID, "exp://127.0.0.1:8081", "host.exp.Exponent", dir);
    const plist = readFileSync(schemeApprovalPath(dir, UDID), "utf8");
    expect(plist).toContain("<key>com.apple.CoreSimulator.CoreSimulatorBridge--&gt;exp</key>");
    expect(plist).toContain("<string>host.exp.Exponent</string>");
  });

  test("keeps approvals that are already there", async () => {
    const dir = home();
    await approveUrlScheme(config(), plutil, UDID, "myapp://home", "com.example.app", dir);
    await approveUrlScheme(config(), plutil, UDID, "exp://127.0.0.1:8081", "host.exp.Exponent", dir);
    const entries = JSON.parse((await plutil(["plutil", schemeApprovalPath(dir, UDID)])).stdout) as Record<string, string>;
    expect(entries).toEqual({ "com.apple.CoreSimulator.CoreSimulatorBridge-->myapp": "com.example.app", [KEY]: "host.exp.Exponent" });
  });

  test("does nothing off macOS", async () => {
    const dir = home();
    await approveUrlScheme(config("linux"), plutil, UDID, "exp://127.0.0.1:8081", "host.exp.Exponent", dir);
    expect(existsSync(schemeApprovalPath(dir, UDID))).toBe(false);
  });

  test("stringPlist escapes keys and values", () => {
    expect(stringPlist({ "a-->b": "x&y" })).toContain("<key>a--&gt;b</key>\n\t<string>x&amp;y</string>");
  });
});
