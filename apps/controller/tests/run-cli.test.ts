import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { AppRun } from "@tesseract/protocol";
import { runCli, type Output } from "../src/cli/commands";
import { formatRun } from "../src/cli/run";
import { makeTempDir, removeTempDirs, startTestController, TEST_TOKEN, writeFiles, type TestController } from "./helpers";

let t: TestController;
let env: Record<string, string>;

function capture(): Output & { stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (text) => stdout.push(text), err: (text) => stderr.push(text) };
}

beforeAll(async () => {
  const workspace = makeTempDir("run-cli");
  writeFiles(workspace, {
    "projects/expo-app/package.json": JSON.stringify({ name: "expo-app", dependencies: { expo: "~58.0.0", react: "19.3.0", "react-native": "0.88.1" }, scripts: { start: "expo start" } }),
    "projects/expo-app/app.json": JSON.stringify({ expo: { name: "expo-app" } }),
  });
  t = await startTestController({ workspace });
  env = { TESSERACT_WORKSPACE: t.workspace, TESSERACT_HOST: "127.0.0.1", TESSERACT_PORT: String(t.controller.url.port), TESSERACT_TOKEN: TEST_TOKEN };
});

afterAll(async () => {
  await t.stop();
  removeTempDirs();
});

describe("tesseract-controller run", () => {
  test("targets lists the host simulator and emulator targets of the project in the current folder", async () => {
    const output = capture();
    expect(await runCli(["run", "targets"], { env, output, cwd: `${t.workspace}/projects/expo-app` })).toBe(0);
    const text = output.stdout.join("\n");
    expect(text).toContain("Run targets for expo-app:");
    expect(text).toMatch(/expo-ios\s+unavailable\s+iOS Simulator/);
    expect(text).toMatch(/expo-android\s+unavailable\s+Android emulator/);
  });

  test("an unavailable target fails with the reason instead of starting", async () => {
    const output = capture();
    expect(await runCli(["run", "expo-ios", "--project", "expo-app"], { env, output })).toBe(1);
    expect(output.stderr.join("\n")).toMatch(/^error: expo-ios is not available for expo-app: /);
  });

  test("rejects unknown targets and missing projects", async () => {
    const unknown = capture();
    expect(await runCli(["run", "iphone", "--project", "expo-app"], { env, output: unknown })).toBe(2);
    expect(unknown.stderr.join("\n")).toContain('Unknown run target "iphone"');
    const nowhere = capture();
    expect(await runCli(["run", "targets"], { env, output: nowhere, cwd: "/" })).toBe(2);
    expect(nowhere.stderr.join("\n")).toContain("Pass --project <id>");
  });

  test("list shows no runs for a project that has none", async () => {
    const output = capture();
    expect(await runCli(["run", "list"], { env, output, cwd: `${t.workspace}/projects/expo-app` })).toBe(0);
    expect(output.stdout.join("\n")).toBe("No app runs.");
  });

  test("formatRun says where the run shows", () => {
    const run: AppRun = {
      id: "app_abc",
      projectId: "expo-app",
      target: "expo-ios",
      dir: null,
      state: "ready",
      port: 8081,
      processIds: [],
      viewer: { kind: "ios", udid: "21227AD4-3397-4FA0-B700-C8DE8B927FDA" },
      actions: [],
      error: null,
      startedAt: "2026-11-06T00:00:00.000Z",
      readyAt: null,
      endedAt: null,
    };
    expect(formatRun(run)).toBe("app_abc expo-ios ready on the host iOS Simulator");
    expect(formatRun({ ...run, state: "failed", viewer: null, error: "Metro exited" })).toBe("app_abc expo-ios failed: Metro exited");
  });
});
