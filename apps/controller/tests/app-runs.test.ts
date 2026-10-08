import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AppRunListSchema, AppRunSchema, RunTargetListSchema, type AppRun, type LogLine, type RunTargetInfo } from "@tesseract/protocol";
import { packageExecCommand, packageScriptCommand } from "../src/services/app-runs";
import { detectProject, detectRunTargetSources, pnpmWorkspacePackages } from "../src/services/project-detect";
import { installFixture, makeTempDir, removeTempDirs, startTestController, waitFor, writeFiles, type TestController } from "./helpers";

const PUBSPEC = "name: hello\nenvironment:\n  sdk: ^3.5.0\ndependencies:\n  flutter:\n    sdk: flutter\n";
const WEB_SERVER = "Bun.serve({ port: Number(process.env.PORT), hostname: process.env.HOST, fetch: () => new Response('web ok') });\nconsole.log('listening on ' + process.env.PORT);\n";

let t: TestController;
let projects: string;

function detect(files: Record<string, string>) {
  const dir = makeTempDir("detect");
  writeFiles(dir, files);
  return detectProject(dir);
}

async function start(projectId: string, body: unknown): Promise<{ status: number; body: AppRun & { error: unknown } }> {
  return t.json("POST", `/v1/projects/${projectId}/app-runs`, body);
}

async function runState(id: string, wanted: (run: AppRun) => boolean, timeoutMs = 15_000): Promise<AppRun> {
  return waitFor(async () => {
    const { body } = await t.json<AppRun>("GET", `/v1/app-runs/${id}`);
    return wanted(AppRunSchema.parse(body)) ? body : null;
  }, timeoutMs);
}

async function logs(processId: string): Promise<LogLine[]> {
  return (await t.json<LogLine[]>("GET", `/v1/processes/${processId}/logs?tail=200`)).body;
}

beforeAll(async () => {
  const workspace = makeTempDir("app-runs");
  projects = join(workspace, "projects");
  const bin = makeTempDir("app-runs-bin");
  writeFiles(projects, {
    "web/package.json": JSON.stringify({ name: "web", scripts: { dev: "bun server.js", test: "echo ok" } }),
    "web/bun.lock": "{}",
    "web/server.js": WEB_SERVER,
    "failing/package.json": JSON.stringify({ name: "failing", scripts: { test: "echo running; echo boom >&2; exit 3" } }),
    "failing/bun.lock": "{}",
    "flutter_app/pubspec.yaml": PUBSPEC,
    "flutter_app/linux/CMakeLists.txt": "",
    "flutter_app/android/build.gradle": "",
    "expo/package.json": JSON.stringify({ name: "expo", dependencies: { expo: "1" } }),
    "expo/bun.lock": "{}",
    "mono/package.json": JSON.stringify({ name: "mono", private: true, workspaces: ["apps/*"] }),
    "mono/bun.lock": "{}",
    "mono/apps/api/package.json": JSON.stringify({ name: "api", scripts: { dev: "bun server.js" } }),
    "mono/apps/mobile/package.json": JSON.stringify({ name: "mobile", dependencies: { expo: "1" } }),
  });
  for (const app of ["expo", "mono/apps/mobile"]) {
    mkdirSync(join(projects, app, "node_modules", ".bin"), { recursive: true });
    installFixture(join(projects, app, "node_modules", ".bin"), "fake-expo.ts", "expo");
  }
  t = await startTestController({
    workspace,
    env: { TESSERACT_FLUTTER: installFixture(bin, "fake-flutter.sh", "flutter") },
    controller: { appRuns: { readyPollMs: 50 } },
  });
});

afterAll(async () => {
  await t.stop();
  removeTempDirs();
});

describe("run target detection", () => {
  test("flutter projects", () => {
    const flutter = detect({ "pubspec.yaml": PUBSPEC, "android/build.gradle": "", "linux/main.cc": "" });
    expect(flutter.framework).toBe("flutter");
    expect(flutter.runTargets).toEqual(["flutter-web", "flutter-linux", "flutter-android", "test"]);
    expect(detect({ "pubspec.yaml": PUBSPEC }).runTargets).toEqual(["flutter-web", "test"]);
    expect(detect({ "pubspec.yaml": "name: pure_dart\ndependencies:\n  path: any\n" }).framework).toBe("unknown");
    expect(detect({ "pubspec.yaml": PUBSPEC, "package.json": "{}" }).framework).toBe("node");
  });

  test("javascript projects", () => {
    const pkg = (value: unknown) => ({ "package.json": JSON.stringify(value) });
    expect(detect(pkg({ dependencies: { vite: "1" }, scripts: { dev: "vite", test: "vitest" } })).runTargets).toEqual(["web-dev", "test"]);
    expect(detect(pkg({ scripts: { build: "tsc" } })).runTargets).toEqual([]);
    expect(detect(pkg({ dependencies: { expo: "1" } })).runTargets).toEqual(["expo-device", "expo-android"]);
    expect(detect(pkg({ dependencies: { expo: "1", "react-native-web": "1" } })).runTargets).toEqual(["expo-device", "expo-web", "expo-android"]);
    expect(detect(pkg({ dependencies: { "react-native": "1" } })).runTargets).toEqual([]);
    expect(detect({ ...pkg({ dependencies: { "react-native": "1" } }), "android/gradlew": "" }).runTargets).toEqual(["rn-android"]);
    expect(detect(pkg({ devDependencies: { electron: "1" }, scripts: { start: "electron ." } })).runTargets).toEqual(["electron-dev"]);
  });

  test("app packages of a monorepo", () => {
    expect(pnpmWorkspacePackages("catalog:\n  zod: ^4\npackages:\n  - 'apps/*'\n  # docs\n  - \"packages/*\" # libs\n  - tools\nonlyBuiltDependencies:\n  - esbuild\n")).toEqual([
      "apps/*",
      "packages/*",
      "tools",
    ]);
    const dir = makeTempDir("detect");
    writeFiles(dir, {
      "package.json": JSON.stringify({ name: "mono", scripts: { dev: "turbo dev", test: "turbo test" } }),
      "pnpm-lock.yaml": "",
      "pnpm-workspace.yaml": "packages:\n  - 'apps/*'\n  - '../outside'\n  - '!apps/ignored'\n",
      "apps/api/package.json": JSON.stringify({ name: "api", scripts: { dev: "node ." } }),
      "apps/mobile/package.json": JSON.stringify({ name: "mobile", dependencies: { expo: "1" }, scripts: { test: "vitest" } }),
      "apps/web/package.json": JSON.stringify({ name: "web", dependencies: { vite: "1" }, scripts: { dev: "vite" } }),
      "apps/z-native/package.json": JSON.stringify({ name: "native", dependencies: { "react-native": "1" } }),
      "apps/z-native/android/gradlew": "",
    });
    const sources = detectRunTargetSources(dir);
    expect(sources.map((source) => [source.target, source.dir])).toEqual([
      ["web-dev", null],
      ["expo-device", "apps/mobile"],
      ["expo-android", "apps/mobile"],
      ["rn-android", "apps/z-native"],
      ["test", null],
    ]);
    expect(sources[1]!.facts.packageManager).toBe("pnpm");
    expect(detectRunTargetSources(join(dir, "apps", "mobile")).map((source) => source.dir)).toEqual([null, null, null]);
  });

  test("package manager commands", () => {
    expect(packageScriptCommand("bun", "dev", ["--port", "1"])).toEqual(["bun", "run", "dev", "--", "--port", "1"]);
    expect(packageScriptCommand(null, "dev", ["--port", "1"])).toEqual(["npm", "run", "dev", "--", "--port", "1"]);
    expect(packageScriptCommand("pnpm", "dev", ["--port", "1"])).toEqual(["pnpm", "run", "dev", "--port", "1"]);
    expect(packageScriptCommand("yarn", "test")).toEqual(["yarn", "run", "test"]);
    expect(packageExecCommand("bun", ["expo"])).toEqual(["bunx", "expo"]);
    expect(packageExecCommand("pnpm", ["expo"])).toEqual(["pnpm", "exec", "expo"]);
    expect(packageExecCommand("yarn", ["expo"])).toEqual(["yarn", "expo"]);
    expect(packageExecCommand(null, ["expo"])).toEqual(["npx", "expo"]);
  });
});

describe("GET /v1/projects/:id/run-targets", () => {
  test("lists offered targets with availability", async () => {
    const { status, body } = await t.json<RunTargetInfo[]>("GET", "/v1/projects/flutter_app/run-targets");
    expect(status).toBe(200);
    const targets = RunTargetListSchema.parse(body);
    expect(targets.map((target) => [target.target, target.available, target.reason])).toEqual([
      ["flutter-web", true, null],
      ["flutter-linux", false, "Display :987 is not available"],
      ["flutter-android", false, "adb is not installed"],
      ["test", true, null],
    ]);
    expect(targets[1]).toMatchObject({ label: "Linux desktop", viewer: "display", actions: ["reload", "restart", "focus"] });
    expect((await t.json("GET", "/v1/projects/ghost/run-targets")).status).toBe(404);
  });
});

describe("app runs", () => {
  test("a web dev server becomes ready with a url viewer and stops", async () => {
    const started = await start("web", { target: "web-dev" });
    expect(started.status).toBe(201);
    const run = AppRunSchema.parse(started.body);
    expect(run).toMatchObject({ projectId: "web", target: "web-dev", state: "starting", viewer: null, actions: [] });
    expect(run.port).toBeGreaterThanOrEqual(5173);
    expect(run.processIds).toHaveLength(1);

    const ready = await runState(run.id, (current) => current.state === "ready");
    expect(ready.viewer).toEqual({ kind: "url", url: null, localUrl: `http://127.0.0.1:${run.port}` });
    expect(ready.readyAt).not.toBeNull();
    expect(await (await fetch(ready.viewer?.kind === "url" ? ready.viewer.localUrl : "")).text()).toBe("web ok");
    expect((await logs(run.processIds[0]!)).map((line) => line.text)).toContain(`$ bun run dev`);

    const duplicate = await start("web", { target: "web-dev" });
    expect(duplicate.status).toBe(409);
    const action = await t.json("POST", `/v1/app-runs/${run.id}/actions`, { action: "reload" });
    expect(action.status).toBe(409);
    const taken = await start("web", { target: "web-dev", port: run.port });
    expect(taken.status).toBe(409);

    const list = AppRunListSchema.parse((await t.json("GET", "/v1/app-runs?projectId=web")).body);
    expect(list.map((entry) => entry.id)).toContain(run.id);
    expect((await t.json<AppRun[]>("GET", "/v1/app-runs?projectId=expo")).body).toEqual([]);

    const stopped = await t.json<AppRun>("DELETE", `/v1/app-runs/${run.id}`);
    expect(stopped.status).toBe(200);
    expect(stopped.body).toMatchObject({ state: "stopped", error: null });
    expect(stopped.body.endedAt).not.toBeNull();
    const process = (await t.json<{ state: string }>("GET", `/v1/processes/${run.processIds[0]}`)).body;
    expect(process.state).toBe("stopped");
  });

  test("rejects targets that are not offered and unknown runs", async () => {
    expect((await start("web", { target: "expo-device" })).status).toBe(400);
    expect((await start("web", { target: "nope" })).status).toBe(400);
    expect((await start("ghost", { target: "test" })).status).toBe(404);
    expect((await start("flutter_app", { target: "flutter-linux" })).body.error).toMatchObject({
      code: "unavailable",
      message: "Display :987 is not available",
    });
    expect((await t.json("GET", "/v1/app-runs/app_missing000")).status).toBe(404);
    expect((await t.json("DELETE", "/v1/app-runs/prc_wrongkind")).status).toBe(404);
  });

  test("a test run ends exited on success and failed with the last error line", async () => {
    const ok = AppRunSchema.parse((await start("web", { target: "test" })).body);
    expect(ok.port).toBeNull();
    const exited = await runState(ok.id, (run) => run.state !== "starting");
    expect(exited).toMatchObject({ state: "exited", error: null, readyAt: null, viewer: null });

    const bad = AppRunSchema.parse((await start("failing", { target: "test" })).body);
    const failed = await runState(bad.id, (run) => run.state !== "starting");
    expect(failed).toMatchObject({ state: "failed", error: "boom" });
    expect((await t.json<AppRun>("DELETE", `/v1/app-runs/${bad.id}`)).body.state).toBe("failed");
  });

  test("flutter machine mode: readable logs, reload and restart", async () => {
    const run = AppRunSchema.parse((await start("flutter_app", { target: "flutter-web" })).body);
    expect(run.port).toBeGreaterThanOrEqual(8090);
    const ready = await runState(run.id, (current) => current.state === "ready");
    expect(ready.viewer).toEqual({ kind: "url", url: null, localUrl: `http://127.0.0.1:${run.port}` });

    const text = (await logs(run.processIds[0]!)).map((line) => line.text);
    expect(text).toContain(`ARGS: run --machine -d web-server --web-hostname 0.0.0.0 --web-port ${run.port}`);
    expect(text).toContain("Compiling application");
    expect(text).toContain("hello from flutter");
    expect(text).toContain("App started");
    expect(text.some((line) => line.startsWith("[{"))).toBe(false);

    const reload = await t.json<AppRun>("POST", `/v1/app-runs/${run.id}/actions`, { action: "reload" });
    expect(reload.status).toBe(200);
    expect(reload.body.state).toBe("ready");
    await waitFor(async () => (await logs(run.processIds[0]!)).some((line) => line.text === "Reloaded 1 of 2 libraries"));

    const restart = await t.json<{ error: { message: string } }>("POST", `/v1/app-runs/${run.id}/actions`, { action: "restart" });
    expect(restart.status).toBe(502);
    expect(restart.body.error.message).toContain("Restart is not supported");
    expect((await t.json("POST", `/v1/app-runs/${run.id}/actions`, { action: "focus" })).status).toBe(409);

    expect((await t.json<AppRun>("DELETE", `/v1/app-runs/${run.id}`)).body.state).toBe("stopped");
    expect((await t.json("POST", `/v1/app-runs/${run.id}/actions`, { action: "reload" })).status).toBe(409);
  });

  test("a flutter app.stop error fails the run with its text", async () => {
    const marker = join(projects, "flutter_app", "flutter-fail");
    writeFileSync(marker, "");
    try {
      const run = AppRunSchema.parse((await start("flutter_app", { target: "flutter-web" })).body);
      const failed = await runState(run.id, (current) => current.state !== "starting");
      expect(failed).toMatchObject({ state: "failed", error: "lib/main.dart:3: Error: Expected a type" });
      const text = (await logs(run.processIds[0]!)).map((line) => line.text);
      expect(text).toContain("Error: Build: Compilation failed");
      expect(text).toContain("App stopped: lib/main.dart:3: Error: Expected a type");
    } finally {
      rmSync(marker);
    }
  });

  test("flutter test runs flutter test", async () => {
    const run = AppRunSchema.parse((await start("flutter_app", { target: "test" })).body);
    expect(await runState(run.id, (current) => current.state !== "starting")).toMatchObject({ state: "exited" });
    expect((await logs(run.processIds[0]!)).map((line) => line.text)).toContain("00:01 +1: All tests passed!");
  });

  test("expo on the phone: deeplink viewer and Metro reload", async () => {
    const run = AppRunSchema.parse((await start("expo", { target: "expo-device" })).body);
    const ready = await runState(run.id, (current) => current.state === "ready");
    expect(ready.viewer).toEqual({
      kind: "deeplink",
      devClientUrl: null,
      expoGoUrl: `exp://127.0.0.1:${run.port}`,
      manifestUrl: `http://127.0.0.1:${run.port}`,
    });
    const text = (await logs(run.processIds[0]!)).map((line) => line.text);
    expect(text).toContain(`ARGS: start --port ${run.port} --go`);
    expect(text).toContain("HOSTNAME:  CI: 1");

    expect((await t.json("POST", `/v1/app-runs/${run.id}/actions`, { action: "reload" })).status).toBe(200);
    const messages = join(projects, "expo", "metro-messages.log");
    await waitFor(() => existsSync(messages) && readFileSync(messages, "utf8").includes("reload"));
    expect(JSON.parse(readFileSync(messages, "utf8").trim().split("\n")[0]!)).toEqual({ version: 2, method: "reload" });

    writeFileSync(join(projects, "expo", "no-metro-socket"), "");
    const failed = await t.json("POST", `/v1/app-runs/${run.id}/actions`, { action: "restart" });
    expect(failed.status).toBe(502);
    expect((await t.json<AppRun>("DELETE", `/v1/app-runs/${run.id}`)).body.state).toBe("stopped");
  });

  test("a monorepo runs its app package in the package folder", async () => {
    const targets = RunTargetListSchema.parse((await t.json("GET", "/v1/projects/mono/run-targets")).body);
    expect(targets.map((target) => [target.target, target.dir, target.label])).toEqual([
      ["expo-device", "apps/mobile", "Expo on the phone · apps/mobile"],
      ["expo-android", "apps/mobile", "Android emulator · apps/mobile"],
    ]);
    const run = AppRunSchema.parse((await start("mono", { target: "expo-device" })).body);
    expect(run.dir).toBe("apps/mobile");
    const ready = await runState(run.id, (current) => current.state === "ready");
    expect(ready.dir).toBe("apps/mobile");
    const process = (await t.json<{ cwd: string }>("GET", `/v1/processes/${run.processIds[0]}`)).body;
    expect(process.cwd).toBe(join(projects, "mono", "apps", "mobile"));
    expect((await t.json<AppRun>("DELETE", `/v1/app-runs/${run.id}`)).body.state).toBe("stopped");
  });

  test("a run that dies before ready fails", async () => {
    mkdirSync(join(projects, "crash"), { recursive: true });
    writeFiles(projects, {
      "crash/package.json": JSON.stringify({ scripts: { dev: "echo 'cannot bind' >&2; exit 1" } }),
      "crash/bun.lock": "{}",
    });
    const run = AppRunSchema.parse((await start("crash", { target: "web-dev" })).body);
    expect(await runState(run.id, (current) => current.state !== "starting")).toMatchObject({ state: "failed", error: "cannot bind" });
  });
});
