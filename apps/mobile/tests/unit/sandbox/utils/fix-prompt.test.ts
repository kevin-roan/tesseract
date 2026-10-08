import type { LogLine } from "@tesseract/protocol";
import { sampleAppRun, sampleBuild, sampleProcess } from "@tesseract/protocol/fixtures";

import {
  FIX_LOG_TAIL,
  appRunFailure,
  buildFailure,
  canFixAppRun,
  canFixBuild,
  canFixProcess,
  failurePrompt,
  processFailure,
} from "@/features/sandbox/utils/fix-prompt";

const line = (seq: number, text: string): LogLine => ({ seq, stream: "stderr", text, ts: "2026-01-01T00:00:00.000Z" });

const failed = { ...sampleProcess, name: "package:win", command: "bun run package:win", state: "failed" as const, exitCode: 1 };

describe("canFix", () => {
  it("only offers a fix for failed runs", () => {
    expect(canFixProcess(failed)).toBe(true);
    expect(canFixProcess(sampleProcess)).toBe(false);
    expect(canFixBuild({ ...sampleBuild, state: "failed" })).toBe(true);
    expect(canFixBuild({ ...sampleBuild, state: "succeeded" })).toBe(false);
    expect(canFixAppRun({ ...sampleAppRun, state: "failed" })).toBe(true);
    expect(canFixAppRun(sampleAppRun)).toBe(false);
  });
});

describe("failurePrompt", () => {
  it("includes the command, exit code and cleaned log tail", () => {
    const prompt = failurePrompt(
      processFailure(failed, [line(1, "\u001b[31mcd: release/app/node_modules/better-sqlite3: No such file\u001b[0m\n")]),
    );
    expect(prompt).toContain("`package:win` failed");
    expect(prompt).toContain("Command: `bun run package:win`");
    expect(prompt).toContain("Exit code: 1");
    expect(prompt).toContain("cd: release/app/node_modules/better-sqlite3: No such file\n```");
    expect(prompt).not.toContain("\u001b");
  });

  it("describes a failed app run with its target, folder and error", () => {
    const run = { ...sampleAppRun, target: "expo-android" as const, dir: "apps/mobile", state: "failed" as const, error: "No Android device found" };
    const prompt = failurePrompt(appRunFailure(run, "Android emulator", [line(1, "at resolveDevice.js:23:10")]));
    expect(prompt).toContain("Running the app on Android emulator (`expo-android` in `apps/mobile`) failed");
    expect(prompt).toContain("Error: No Android device found");
    expect(prompt).toContain("at resolveDevice.js:23:10");
  });

  it("keeps only the last lines", () => {
    const lines = Array.from({ length: FIX_LOG_TAIL + 10 }, (_, index) => line(index, `line ${index}`));
    const prompt = failurePrompt(processFailure(failed, lines));
    expect(prompt).not.toContain("line 9\n");
    expect(prompt).toContain(`line ${FIX_LOG_TAIL + 9}`);
  });

  it("says when there is no output and carries a build's error", () => {
    const prompt = failurePrompt(buildFailure({ ...sampleBuild, state: "failed", error: "gradle exited 1" }, []));
    expect(prompt).toContain("Error: gradle exited 1");
    expect(prompt).toContain("No log output was captured.");
  });
});
