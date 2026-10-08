import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import { describe, expect, it } from "vitest";
import type { FileProbe } from "./command";
import { EmulatorViewer, viewerArgs } from "./viewer";

const OPEN_WINDOW_MS = 30;
const EXIT_WINDOW_MS = 5_000;

class FakeViewer extends EventEmitter {
  stderr = new PassThrough();
}

function setup(options: { scrcpy?: boolean; exit?: { code: number; stderr?: string[] } } = {}) {
  const calls: { file: string; args: readonly string[]; options: SpawnOptions }[] = [];
  const files: FileProbe = {
    isFile: () => options.scrcpy !== false,
    isExecutable: (path) => options.scrcpy !== false && path === "/usr/bin/scrcpy",
  };
  const viewer = new EmulatorViewer({
    env: () => ({ PATH: "/usr/bin", TESSERACT_ADB: "/sdk/platform-tools/adb" }),
    platform: "linux",
    files,
    earlyExitMs: options.exit ? EXIT_WINDOW_MS : OPEN_WINDOW_MS,
    spawn: (file, args, spawnOptions) => {
      calls.push({ file, args, options: spawnOptions });
      const child = new FakeViewer();
      if (options.exit) {
        const { code, stderr = [] } = options.exit;
        setImmediate(() => {
          for (const line of stderr) child.stderr.write(`${line}\n`);
          child.stderr.end();
          setImmediate(() => child.emit("close", code));
        });
      }
      return child as unknown as ChildProcess;
    },
  });
  return { viewer, calls };
}

const REQUEST = { serial: "127.0.0.1:41555", title: "tesseract · Android emulator" };

describe("EmulatorViewer", () => {
  it("opens scrcpy once with the GTK arguments and the SDK adb", async () => {
    const { viewer, calls } = setup();
    await viewer.open(REQUEST);
    await viewer.open(REQUEST);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.file).toBe("/usr/bin/scrcpy");
    expect(calls[0]?.args).toEqual(viewerArgs(REQUEST));
    expect(calls[0]?.args).toEqual(["--serial", REQUEST.serial, "--window-title", REQUEST.title, "--no-audio"]);
    expect(calls[0]?.options.env?.ADB).toBe("/sdk/platform-tools/adb");
    expect(viewer.running()).toBe(true);
  });

  it("asks for scrcpy when it is missing", async () => {
    const { viewer } = setup({ scrcpy: false });
    await expect(viewer.open(REQUEST)).rejects.toMatchObject({
      code: "not_found",
      message: "The app runs on the emulator; install scrcpy to see its screen here",
    });
  });

  it("refuses an empty serial", async () => {
    const { viewer } = setup();
    await expect(viewer.open({ serial: "", title: "x" })).rejects.toMatchObject({ message: "The emulator is not reachable from this machine" });
  });

  it("reports an early failure with the last ERROR: line", async () => {
    const { viewer } = setup({ exit: { code: 1, stderr: ["INFO: hi", "ERROR: Could not find any ADB device", "trailer"] } });
    await expect(viewer.open(REQUEST)).rejects.toMatchObject({ message: "Could not find any ADB device" });
    expect(viewer.running()).toBe(false);
  });
});
