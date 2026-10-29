import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HostSessionSchema, HostToolchainSchema } from "@tesseract/protocol";
import { silentLogger } from "../src/core/logger";
import { loadHostConfig } from "../src/host/config";
import { startHostShell, type HostShell } from "../src/host/server";
import { HostStateStore } from "../src/host/state";
import { androidSourceEnv, resolveToolchain, sdkCandidates, savedToolchainEnv, toolchainEnv } from "../src/host/toolchain";
import { makeTempDir, removeTempDirs } from "./helpers";

const PIN = "482913";
let shell: HostShell | null = null;

function tool(path: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, "#!/bin/sh\n");
  chmodSync(path, 0o755);
}

function sdk(root: string, emulator = false): string {
  tool(join(root, "platform-tools", "adb"));
  if (emulator) tool(join(root, "emulator", "emulator"));
  return root;
}

function jdk(root: string): string {
  tool(join(root, "bin", "java"));
  return root;
}

afterEach(async () => {
  await shell?.stop();
  shell = null;
});

afterAll(() => removeTempDirs());

describe("resolveToolchain", () => {
  test("detects Android Studio's SDK on macOS when nothing is configured", () => {
    const home = makeTempDir("toolchain");
    const studio = sdk(join(home, "Library", "Android", "sdk"));
    const resolved = resolveToolchain({}, { HOME: home, PATH: "/usr/bin" }, "darwin");
    expect(resolved.android).toEqual({ path: studio, source: "detected" });
    expect(sdkCandidates({ HOME: home }, "darwin")).toEqual([{ path: studio, label: "Android Studio", usable: true }]);
  });

  test("saved settings win over the environment, which wins over detection", () => {
    const home = makeTempDir("toolchain");
    sdk(join(home, "Android", "Sdk"));
    const fromEnv = sdk(join(home, "env-sdk"));
    const saved = sdk(join(home, "saved-sdk"));
    const java = jdk(join(home, "jdk"));
    const env = { HOME: home, ANDROID_HOME: fromEnv };
    expect(resolveToolchain({}, env, "linux").android).toEqual({ path: fromEnv, source: "env" });
    expect(resolveToolchain({ androidSdkRoot: saved, javaHome: java }, env, "linux")).toEqual({
      android: { path: saved, source: "settings" },
      java: { path: java, source: "settings" },
    });
  });

  test("terminal env exports the SDK and JDK and puts their tools first on PATH", () => {
    const home = makeTempDir("toolchain");
    const root = sdk(join(home, "sdk"), true);
    const java = jdk(join(home, "jdk"));
    const env = toolchainEnv({ android: { path: root, source: "settings" }, java: { path: java, source: "settings" } }, { PATH: "/usr/bin:/bin" }, "linux");
    expect(env).toEqual({
      JAVA_HOME: java,
      ANDROID_HOME: root,
      ANDROID_SDK_ROOT: root,
      PATH: [join(java, "bin"), join(root, "platform-tools"), join(root, "emulator"), "/usr/bin", "/bin"].join(":"),
    });
  });

  test("the emulator config follows a saved SDK and its adb", () => {
    const root = sdk(join(makeTempDir("toolchain"), "sdk"));
    expect(androidSourceEnv({ TESSERACT_ADB: "/old/adb", PATH: "/usr/bin" }, { androidSdkRoot: root })).toEqual({
      PATH: "/usr/bin",
      TESSERACT_ANDROID_SDK_ROOT: root,
      TESSERACT_ADB: join(root, "platform-tools", "adb"),
    });
    expect(androidSourceEnv({ TESSERACT_ADB: "adb" }, {})).toEqual({ TESSERACT_ADB: "adb" });
  });

  test("host workspace reads the host shell's saved settings", () => {
    const home = makeTempDir("toolchain");
    const stateDir = join(home, "state");
    const root = sdk(join(home, "picked"));
    new HostStateStore(stateDir, join(stateDir, "state.json")).updateToolchain({ androidSdkRoot: root });
    const env = savedToolchainEnv({ HOME: home, TESSERACT_HOST_SHELL_DIR: stateDir, PATH: "/usr/bin" }, "linux");
    expect(env.ANDROID_HOME).toBe(root);
  });
});

describe("/v1/android/toolchain", () => {
  async function start() {
    const home = makeTempDir("toolchain-host");
    const env = { HOME: home, TESSERACT_HOST_SHELL_DIR: join(home, "state"), SHELL: "/bin/sh", PATH: "/usr/bin:/bin" };
    const config = { ...loadHostConfig(env, { bind: "127.0.0.1", port: "0" }, true, "linux"), shell: ["/bin/sh"] };
    const store = new HostStateStore(config.stateDir, config.stateFile);
    await store.setPin(PIN);
    shell = startHostShell(config, { logger: silentLogger, workspace: () => null, toolchain: { env, platform: "linux" } });
    const base = shell.url.href.replace(/\/$/, "");
    const token = store.ensureToken();
    const unlocked = await fetch(`${base}/v1/host/unlock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ pin: PIN }),
    });
    const session = HostSessionSchema.parse(await unlocked.json()).session;
    const call = async (method: string, body?: unknown) => {
      const response = await fetch(`${base}/v1/android/toolchain`, {
        method,
        headers: { Authorization: `Bearer ${session}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, body: (await response.json()) as unknown };
    };
    return { home, store, call };
  }

  test("saves an SDK and JDK, points the emulator config at the SDK and clears back to automatic", async () => {
    const { home, store, call } = await start();
    const root = sdk(join(home, "custom-sdk"), true);
    const java = jdk(join(home, "custom-jdk"));

    const initial = HostToolchainSchema.parse((await call("GET")).body);
    expect(initial.android.configured).toBeNull();

    const saved = await call("PUT", { androidSdkRoot: root, javaHome: java });
    expect(saved.status).toBe(200);
    const status = HostToolchainSchema.parse(saved.body);
    expect(status.android).toMatchObject({ configured: root, path: root, source: "settings", adb: join(root, "platform-tools", "adb"), emulator: join(root, "emulator", "emulator") });
    expect(status.java).toMatchObject({ configured: java, path: java, source: "settings" });
    expect(store.toolchain()).toEqual({ androidSdkRoot: root, javaHome: java });
    expect(shell?.toolchain.terminalEnv().ANDROID_HOME).toBe(root);

    const cleared = HostToolchainSchema.parse((await call("PUT", { androidSdkRoot: null })).body);
    expect(cleared.android.configured).toBeNull();
    expect(store.toolchain()).toEqual({ javaHome: java });
  });

  test("rejects a folder that does not exist", async () => {
    const { home, call } = await start();
    const result = await call("PUT", { androidSdkRoot: join(home, "missing") });
    expect(result.status).toBe(400);
  });
});
