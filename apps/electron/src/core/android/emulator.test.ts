import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EmulatorState } from "../../shared/contracts/android";
import { EmulatorController, emulatorArgs, failureLine, findConsolePort } from "./emulator";
import { tempDir, testPaths } from "./test-support";

const posix = process.platform !== "win32";

async function script(file: string, body: string): Promise<void> {
  await writeFile(file, `#!/bin/sh\n${body}\n`);
  await chmod(file, 0o755);
}

async function waitFor(states: EmulatorState[], kind: EmulatorState["kind"], timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!states.some((state) => state.kind === kind)) {
    if (Date.now() - start > timeoutMs) throw new Error(`no ${kind} state: ${JSON.stringify(states)}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe("emulator helpers", () => {
  it("builds the launch arguments", () => {
    expect(emulatorArgs("Pixel", 5554)).toEqual(["-avd", "Pixel", "-port", "5554", "-no-audio", "-no-boot-anim"]);
    expect(emulatorArgs("Pixel", 5556, { headless: true, gpu: "swiftshader_indirect" })).toEqual([
      "-avd", "Pixel", "-port", "5556", "-no-audio", "-no-boot-anim", "-no-window", "-gpu", "swiftshader_indirect",
    ]);
  });

  it("picks the last error line without its level prefix", () => {
    expect(failureLine(["INFO | a", "ERROR        | detected a hanging thread", "INFO | b"])).toBe("detected a hanging thread");
    expect(failureLine(["just text", ""])).toBe("just text");
    expect(failureLine([])).toBeNull();
  });

  it("finds the first even console port whose adb port is free too", async () => {
    const busy = new Set([5554, 5557]);
    expect(await findConsolePort(async (port) => !busy.has(port))).toBe(5558);
    expect(await findConsolePort(async () => false)).toBeNull();
  });
});

describe.runIf(posix)("EmulatorController", () => {
  let dir = "";
  let cleanup: () => Promise<void> = async () => undefined;
  let sdk = "";
  let controller: EmulatorController | null = null;

  beforeEach(async () => {
    ({ dir, cleanup } = await tempDir());
    sdk = join(dir, "sdk");
    await mkdir(join(sdk, "emulator"), { recursive: true });
    await mkdir(join(sdk, "platform-tools"), { recursive: true });
    await script(join(sdk, "platform-tools", "adb"), 'echo 1');
  });
  afterEach(async () => {
    await controller?.stop();
    controller = null;
    await cleanup();
  });

  function create(states: EmulatorState[], logs: string[] = []): EmulatorController {
    controller = new EmulatorController((state) => states.push(state), {
      paths: testPaths(join(dir, "home"), { PATH: process.env.PATH, TESSERACT_HOST_SHELL_TOKEN: "secret" }),
      onLog: (line) => logs.push(line),
      bootPollMs: 20,
      stopGraceMs: 500,
      isPortFree: async () => true,
    });
    return controller;
  }

  it("starts, waits for boot_completed and stops", async () => {
    await script(join(sdk, "emulator", "emulator"), 'echo "args: $*"; echo "sdk: $ANDROID_SDK_ROOT token: ${TESSERACT_HOST_SHELL_TOKEN:-none}"; exec sleep 30');
    const states: EmulatorState[] = [];
    const logs: string[] = [];
    const emulator = create(states, logs);
    const started = await emulator.start(sdk, "Tesseract_API_36");
    expect(started).toMatchObject({ kind: "starting", avd: "Tesseract_API_36" });
    await expect(emulator.start(sdk, "Other")).rejects.toMatchObject({ code: "unavailable" });
    await waitFor(states, "running");
    expect(emulator.state()).toEqual({ kind: "running", avd: "Tesseract_API_36", serial: "emulator-5554" });
    expect(logs).toContain("args: -avd Tesseract_API_36 -port 5554 -no-audio -no-boot-anim");
    expect(logs).toContain(`sdk: ${sdk} token: none`);
    expect(emulator.runningAvd()).toBe("Tesseract_API_36");
    expect(await emulator.stop()).toEqual({ kind: "stopped" });
    expect(states.map((state) => state.kind)).toEqual(["starting", "running", "stopping", "stopped"]);
  });

  it("stops through adb emu kill before signalling the launcher", async () => {
    const marker = join(dir, "stop-marker");
    await script(join(sdk, "platform-tools", "adb"), `if [ "$3" = "emu" ]; then echo "$*" > "${marker}"; kill "$(cat "${marker}.pid")"; exit 0; fi; echo 1`);
    await script(join(sdk, "emulator", "emulator"), `echo $$ > "${marker}.pid"; exec sleep 30`);
    const states: EmulatorState[] = [];
    const emulator = create(states);
    await emulator.start(sdk, "Tesseract_API_36");
    await waitFor(states, "running");
    expect(await emulator.stop()).toEqual({ kind: "stopped" });
    expect((await readFile(marker, "utf8")).trim()).toBe("-s emulator-5554 emu kill");
  });

  it("reports a failed start with the emulator's last line", async () => {
    await script(join(sdk, "emulator", "emulator"), 'echo "PANIC: Unknown AVD name [Nope]" >&2; exit 1');
    const states: EmulatorState[] = [];
    await create(states).start(sdk, "Nope");
    await waitFor(states, "failed");
    expect(states.at(-1)).toEqual({ kind: "failed", message: "The emulator exited with code 1: Unknown AVD name [Nope]" });
  });

  it("refuses to start without an emulator binary", async () => {
    await expect(create([]).start(join(dir, "empty"), "x")).rejects.toMatchObject({ code: "not_found" });
  });
});
