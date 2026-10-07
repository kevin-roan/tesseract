import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { FileProbe } from "./command";
import { hostDaemonEnv, resolveHostSdkRoot, viewerEnv } from "./env";

function probe(files: string[]): FileProbe {
  return { isFile: (path) => files.includes(path), isExecutable: (path) => files.includes(path) };
}

const SDK = "/home/u/.local/share/theone/android-sdk";
const CUSTOM = "/opt/android";
const emulator = (root: string) => join(root, "emulator", "emulator");
const adb = (root: string) => join(root, "platform-tools", "adb");

describe("hostDaemonEnv", () => {
  it("passes the configured SDK and its adb", () => {
    const env = hostDaemonEnv(
      { PATH: "/usr/bin" },
      { platform: "linux", sdkRoot: CUSTOM, defaultSdkRoot: SDK, files: probe([emulator(CUSTOM), adb(CUSTOM), emulator(SDK)]) },
    );
    expect(env.THEONE_ANDROID_SDK_ROOT).toBe(CUSTOM);
    expect(env.THEONE_ADB).toBe(adb(CUSTOM));
    expect(env.PATH).toBe("/usr/bin");
  });

  it("falls back to the default SDK and skips SDKs without an emulator", () => {
    const files = probe([emulator(SDK)]);
    expect(resolveHostSdkRoot({ platform: "linux", sdkRoot: CUSTOM, defaultSdkRoot: SDK, files })).toBe(SDK);
    const env = hostDaemonEnv({}, { platform: "linux", sdkRoot: CUSTOM, defaultSdkRoot: SDK, files });
    expect(env.THEONE_ANDROID_SDK_ROOT).toBe(SDK);
    expect(env.THEONE_ADB).toBeUndefined();
    expect(hostDaemonEnv({}, { platform: "linux", sdkRoot: null, defaultSdkRoot: SDK, files: probe([]) }).THEONE_ANDROID_SDK_ROOT).toBeUndefined();
  });

  it("never overrides the user's variables", () => {
    const env = hostDaemonEnv(
      { THEONE_ANDROID_SDK_ROOT: "/mine", THEONE_ADB: "adb", THEONE_FFMPEG: "/x/ffmpeg" },
      { platform: "linux", sdkRoot: CUSTOM, defaultSdkRoot: SDK, ffmpeg: "/bundled/ffmpeg", files: probe([emulator(CUSTOM), adb(CUSTOM), "/bundled/ffmpeg"]) },
    );
    expect(env.THEONE_ANDROID_SDK_ROOT).toBe("/mine");
    expect(env.THEONE_ADB).toBe("adb");
    expect(env.THEONE_FFMPEG).toBe("/x/ffmpeg");
  });

  it("adds a bundled scrcpy server and ffmpeg", () => {
    const env = hostDaemonEnv(
      {},
      {
        platform: "darwin",
        sdkRoot: null,
        defaultSdkRoot: null,
        scrcpy: { server: "/r/scrcpy-server", version: "3.3.4" },
        ffmpeg: "/r/ffmpeg",
        files: probe(["/r/scrcpy-server", "/r/ffmpeg"]),
      },
    );
    expect(env).toMatchObject({ THEONE_SCRCPY_SERVER: "/r/scrcpy-server", THEONE_SCRCPY_VERSION: "3.3.4", THEONE_FFMPEG: "/r/ffmpeg" });
  });

  it("uses .exe tools on Windows", () => {
    const root = "C:\\sdk";
    const files = probe([join(root, "emulator", "emulator.exe"), join(root, "platform-tools", "adb.exe")]);
    const env = hostDaemonEnv({}, { platform: "win32", sdkRoot: root, defaultSdkRoot: null, files });
    expect(env.THEONE_ADB).toBe(join(root, "platform-tools", "adb.exe"));
  });
});

describe("viewerEnv", () => {
  it("points scrcpy at the SDK adb", () => {
    expect(viewerEnv({ THEONE_ADB: "/sdk/platform-tools/adb" }).ADB).toBe("/sdk/platform-tools/adb");
    expect(viewerEnv({ THEONE_ADB: "adb" }).ADB).toBeUndefined();
    expect(viewerEnv({ THEONE_ADB: "/sdk/adb", ADB: "/mine" }).ADB).toBe("/mine");
  });
});
