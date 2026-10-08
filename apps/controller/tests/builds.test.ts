import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, symlinkSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { ArtifactListSchema, BuildJobSchema, LogLineListSchema, LogStreamMessageSchema, type BuildJob } from "@tesseract/protocol";
import { artifactExtension, artifactFileName, sanitizeVersion, sha256File } from "../src/services/artifacts";
import { resolveRecipe } from "../src/services/build-recipes";
import { detectProject } from "../src/services/project-detect";
import { labelledPid, makeTempDir, processGone, removeTempDirs, startTestController, waitFor, writeFiles, type TestController } from "./helpers";

let t: TestController;
let workspace: string;

const pkg = (name: string, build: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ name, version: "2.0.1", scripts: { build }, ...extra });

async function startBuild(projectId: string, target: string, profile?: string): Promise<BuildJob> {
  const { status, body } = await t.json("POST", "/v1/builds", { projectId, target, ...(profile ? { profile } : {}) });
  if (status !== 201) throw new Error(`build failed to start: ${status} ${JSON.stringify(body)}`);
  return BuildJobSchema.parse(body);
}

async function settled(id: string, timeoutMs = 15_000): Promise<BuildJob> {
  return waitFor(async () => {
    const build = BuildJobSchema.parse((await t.json("GET", `/v1/builds/${id}`)).body);
    return build.endedAt ? build : null;
  }, timeoutMs);
}

beforeAll(async () => {
  workspace = makeTempDir("build");
  writeFiles(join(workspace, "projects"), {
    "site/package.json": pkg("site", "echo compiling && mkdir -p dist/assets && echo '<h1>hi</h1>' > dist/index.html && echo x > dist/assets/app.js && echo build-finished"),
    "site/bun.lock": "{}",
    "slow/package.json": pkg("slow", "sleep 1 && echo slow-done"),
    "slow/bun.lock": "{}",
    "broken/package.json": pkg("broken", "echo about-to-fail && exit 4"),
    "broken/bun.lock": "{}",
    "forever/package.json": pkg("forever", "echo started-forever && sleep 60"),
    "forever/bun.lock": "{}",
    "leaky/package.json": pkg("leaky", "sleep 300 & echo leftover=$!"),
    "leaky/bun.lock": "{}",
    "nothing/README.md": "no package.json\n",
    "flavors/android/gradlew": [
      'echo "gradlew $*"',
      'variant="$(echo "${1#assemble}" | tr A-Z a-z)"',
      'for flavor in free paid; do mkdir -p "app/build/outputs/apk/$flavor/$variant" && echo "$flavor" > "app/build/outputs/apk/$flavor/$variant/app-$flavor-$variant.apk"; done',
      "mkdir -p app/.cxx/x86_64 ../node_modules/.pnpm/rn@1/node_modules/rn/android/.cxx ../node_modules/@scope/lib/android/build/intermediates",
    ].join("\n"),
    "flavors/node_modules/@scope/lib/android/src/main/Lib.kt": "class Lib\n",
    "outside/android/build/keep.txt": "not the project's\n",
    "flavors/android/app/build/outputs/apk/free/release/stale-release.apk": "old",
    "flavors/android/app/build/outputs/apk/free/debug/app-free-debug-0.9.apk": "previous version",
  });
  symlinkSync(join(workspace, "projects/outside"), join(workspace, "projects/flavors/node_modules/linked"));
  const lastWeek = new Date(Date.now() - 7 * 24 * 3_600_000);
  utimesSync(join(workspace, "projects/flavors/android/app/build/outputs/apk/free/debug/app-free-debug-0.9.apk"), lastWeek, lastWeek);
  t = await startTestController({
    workspace,
    controller: { toolProbes: [{ name: "git", bin: "git", args: ["--version"] }, { name: "java", bin: "git", args: ["--version"] }] },
  });
});

afterAll(async () => {
  await t.stop();
  removeTempDirs();
});

describe("build queue", () => {
  test("script target streams logs and state transitions", async () => {
    const queued = await startBuild("site", "script");
    expect(queued).toMatchObject({ state: "queued", profile: "debug", target: "script", artifacts: [] });
    const socket = await t.socket(`/v1/builds/${queued.id}/logs/stream`);
    const exit = await socket.waitFor<{ type: string; code?: number | null }>((message) => message.type === "exit", 15_000);
    expect(exit).toEqual({ type: "exit", code: 0 });
    const messages = socket.messages.map((message) => LogStreamMessageSchema.parse(message));
    const states = messages.flatMap((message) => (message.type === "build" ? [message.build.state] : []));
    expect(states[0]).toMatch(/queued|running/);
    expect(states.at(-1)).toBe("succeeded");
    const stages = messages.flatMap((message) => (message.type === "build" && message.build.stage ? [message.build.stage] : []));
    expect(stages).toContain("compile");
    const texts = messages.flatMap((message) => (message.type === "log" ? [message.line.text] : []));
    expect(texts).toContain("compiling");
    expect(texts).toContain("build-finished");
    expect(texts.some((text) => text.includes("bun run build"))).toBe(true);

    const done = await settled(queued.id);
    expect(done).toMatchObject({ state: "succeeded", progress: 1, error: null, artifacts: [] });
    const logs = LogLineListSchema.parse((await t.json("GET", `/v1/builds/${queued.id}/logs?tail=5`)).body);
    expect(logs.length).toBe(5);
  });

  test("runs one build at a time in FIFO order", async () => {
    const first = await startBuild("slow", "script");
    const second = await startBuild("site", "script");
    await Bun.sleep(300);
    expect(BuildJobSchema.parse((await t.json("GET", `/v1/builds/${second.id}`)).body).state).toBe("queued");
    const [a, b] = await Promise.all([settled(first.id), settled(second.id)]);
    expect(a.state).toBe("succeeded");
    expect(b.state).toBe("succeeded");
    expect(Date.parse(b.startedAt ?? "")).toBeGreaterThanOrEqual(Date.parse(a.endedAt ?? ""));
  });

  test("a failing stage fails the build with its exit code", async () => {
    const build = await settled((await startBuild("broken", "script")).id);
    expect(build.state).toBe("failed");
    expect(build.error).toContain("exit code 4");
  });

  test("cancel kills a running build and removes queued ones", async () => {
    const running = await startBuild("forever", "script");
    const queued = await startBuild("site", "script");
    await waitFor(async () => LogLineListSchema.parse((await t.json("GET", `/v1/builds/${running.id}/logs`)).body).some((line) => line.text === "started-forever"));
    const cancelledQueued = BuildJobSchema.parse((await t.json("DELETE", `/v1/builds/${queued.id}`)).body);
    expect(cancelledQueued.state).toBe("cancelled");
    const started = Date.now();
    const cancelled = BuildJobSchema.parse((await t.json("DELETE", `/v1/builds/${running.id}`)).body);
    expect(cancelled.state).toBe("cancelled");
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  test("a step that leaves a background process behind does not leak it", async () => {
    const build = await settled((await startBuild("leaky", "script")).id);
    expect(build.state).toBe("succeeded");
    const texts = LogLineListSchema.parse((await t.json("GET", `/v1/builds/${build.id}/logs`)).body).map((line) => line.text);
    expect(processGone(labelledPid(texts.join("\n"), "leftover"))).toBe(true);
    expect(texts).toContainEqual(expect.stringMatching(/^Stopping 1 process left running in the process group: sleep \(\d+\)$/));
  });

  test("rejects targets the project does not support", async () => {
    const { status, body } = await t.json<{ error: { message: string } }>("POST", "/v1/builds", { projectId: "nothing", target: "web" });
    expect(status).toBe(400);
    expect(body.error.message).toContain("not available");
    expect((await t.json("POST", "/v1/builds", { projectId: "ghost", target: "script" })).status).toBe(404);
  });
});

describe("artifacts", () => {
  test("web builds produce predictable, hashed, downloadable artifacts", async () => {
    const events = await t.socket("/v1/events");
    const first = await settled((await startBuild("site", "web")).id);
    expect(first.state).toBe("succeeded");
    expect(first.artifacts).toHaveLength(1);
    const artifact = first.artifacts[0]!;
    expect(artifact.fileName).toBe("site-web-debug-2.0.1.zip");
    expect(artifact.path).toBe(join(workspace, "artifacts", "site-web-debug-2.0.1.zip"));
    expect(artifact.platform).toBe("web");
    expect(artifact.sha256).toBe(await sha256File(artifact.path));
    expect(artifact.sizeBytes).toBe(Bun.file(artifact.path).size);
    const listing = Bun.spawnSync(["unzip", "-l", artifact.path]).stdout.toString();
    expect(listing).toContain("index.html");
    expect(listing).toContain("assets/app.js");
    await events.waitFor((message: { type: string; artifact?: { id: string } }) => message.type === "artifact.created" && message.artifact?.id === artifact.id);
    events.close();

    const second = await settled((await startBuild("site", "web", "release")).id);
    expect(second.artifacts[0]?.fileName).toBe("site-web-release-2.0.1.zip");
    const third = await settled((await startBuild("site", "web")).id);
    expect(third.artifacts[0]?.fileName).toBe("site-web-debug-2.0.1-2.zip");

    const list = ArtifactListSchema.parse((await t.json("GET", "/v1/artifacts?projectId=site")).body);
    expect(list.map((item) => item.fileName)).toContain("site-web-debug-2.0.1-2.zip");

    const ticket = await t.ticket();
    const url = `${t.baseUrl}/v1/artifacts/${artifact.id}/download?ticket=${ticket}`;
    const download = await fetch(url);
    expect(download.status).toBe(200);
    expect(download.headers.get("content-disposition")).toContain('filename="site-web-debug-2.0.1.zip"');
    expect(download.headers.get("content-type")).toBe("application/zip");
    const bytes = new Uint8Array(await download.arrayBuffer());
    expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(artifact.sha256);
    expect((await fetch(url)).status).toBe(401);
    expect((await fetch(`${t.baseUrl}/v1/artifacts/${artifact.id}/download`)).status).toBe(401);
    expect((await t.request("GET", `/v1/artifacts/${artifact.id}/download`)).status).toBe(200);
    expect((await t.request("GET", "/v1/artifacts/art_missing000/download")).status).toBe(404);
  });

  test("android builds collect every flavor of the requested profile, from this build only", async () => {
    const build = await settled((await startBuild("flavors", "android-apk")).id);
    expect(build.state).toBe("succeeded");
    expect(build.artifacts.map((artifact) => artifact.fileName)).toEqual(["flavors-android-debug-0.0.0.apk", "flavors-android-debug-0.0.0-2.apk"]);
    const contents = await Promise.all(build.artifacts.map((artifact) => Bun.file(artifact.path).text()));
    expect(contents).toEqual(["free\n", "paid\n"]);
    const logs = LogLineListSchema.parse((await t.json("GET", `/v1/builds/${build.id}/logs`)).body);
    expect(logs.map((line) => line.text)).toContain("gradlew assembleDebug --no-daemon --console=plain");
  });

  test("android builds delete their intermediate build directories afterwards, inside the project only", async () => {
    const project = join(workspace, "projects/flavors");
    const build = await settled((await startBuild("flavors", "android-apk", "release")).id);
    expect(build.state).toBe("succeeded");
    expect(await Promise.all(build.artifacts.map((artifact) => Bun.file(artifact.path).text()))).toEqual(["free\n", "paid\n"]);
    for (const dir of ["android/app/build", "android/app/.cxx", "node_modules/.pnpm/rn@1/node_modules/rn/android/.cxx", "node_modules/@scope/lib/android/build"]) {
      expect(existsSync(join(project, dir))).toBe(false);
    }
    expect(existsSync(join(project, "node_modules/@scope/lib/android/src/main/Lib.kt"))).toBe(true);
    expect(existsSync(join(workspace, "projects/outside/android/build/keep.txt"))).toBe(true);
    const logs = LogLineListSchema.parse((await t.json("GET", `/v1/builds/${build.id}/logs`)).body);
    expect(logs.map((line) => line.text)).toContain("▶ cleanup: removing 4 intermediate build directories");
  });

  test("naming helpers", () => {
    const meta = { projectId: "hello", buildId: null, platform: "windows", profile: "release" as const, version: "1.0.0-beta.1" };
    expect(artifactFileName(meta, ".exe", 1)).toBe("hello-windows-release-1.0.0-beta.1.exe");
    expect(artifactFileName(meta, ".exe", 3)).toBe("hello-windows-release-1.0.0-beta.1-3.exe");
    expect(artifactExtension("Hello Setup 1.0.0.exe")).toBe(".exe");
    expect(artifactExtension("app.tar.gz")).toBe(".tar.gz");
    expect(artifactExtension("App-1.0.0.AppImage")).toBe(".AppImage");
    expect(sanitizeVersion(" 1.0/../x ")).toBe("1.0-..-x");
    expect(sanitizeVersion(undefined)).toBe("0.0.0");
  });
});

describe("recipes", () => {
  const recipeFor = (files: Record<string, string>, target: Parameters<typeof resolveRecipe>[0]["target"], profile: "debug" | "release" = "debug") => {
    const dir = makeTempDir("recipe");
    writeFiles(dir, files);
    return resolveRecipe({ facts: detectProject(dir), target, profile, display: ":1", env: { HOME: "/home/dev" } });
  };

  const electronApp = {
    "package.json": JSON.stringify({
      name: "hello",
      version: "0.1.0",
      scripts: { build: "tsc" },
      dependencies: { "left-pad": "1.0.0" },
      devDependencies: { electron: "^38.0.0", "electron-builder": "^26.0.0" },
      build: { directories: { output: "release" } },
    }),
    "pnpm-lock.yaml": "",
  };

  test("electron-builder for Windows runs under wine with the detected package manager", () => {
    const recipe = recipeFor(electronApp, "electron-windows", "release");
    expect(recipe.steps).toEqual([
      { stage: "install", command: "pnpm install" },
      { stage: "compile", command: "pnpm run build" },
      { stage: "package", command: "pnpm exec electron-builder --win nsis --x64 --publish never" },
    ]);
    expect(recipe.env).toEqual({
      WINEPREFIX: "/home/dev/.wine",
      WINEARCH: "win64",
      WINEDEBUG: "-all",
      WINEDLLOVERRIDES: "mscoree,mshtml=",
      DISPLAY: ":1",
    });
    expect(recipe.requires).toEqual(["wine"]);
    expect(recipe.collect).toMatchObject({ kind: "files", platform: "windows", root: "release", patterns: ["*.exe"] });
    expect(recipe.collect?.kind === "files" && recipe.collect.exclude?.test("x.__uninstaller.exe")).toBe(true);
  });

  test("electron-builder for Linux, debug profile", () => {
    const recipe = recipeFor(electronApp, "electron-linux");
    expect(recipe.steps.at(-1)?.command).toBe("pnpm exec electron-builder --linux AppImage --x64 --publish never -c.compression=store");
    expect(recipe.collect).toMatchObject({ platform: "linux", patterns: ["*.AppImage", "*.deb"] });
  });

  test("electron forge", () => {
    const recipe = recipeFor({ "package.json": JSON.stringify({ devDependencies: { "@electron-forge/cli": "7", electron: "38" } }) }, "electron-windows");
    expect(recipe.steps.at(-1)?.command).toBe("npx --yes=false electron-forge make --platform win32 --arch x64");
    expect(recipe.collect).toMatchObject({ root: "out/make" });
  });

  test("android from an Expo app prebuilds first", () => {
    const recipe = recipeFor(
      { "package.json": JSON.stringify({ dependencies: { expo: "56" } }), "app.json": "{}", "bun.lock": "" },
      "android-apk",
      "release",
    );
    expect(recipe.steps.map((step) => step.command)).toEqual([
      "bun install",
      "bunx --no-install expo prebuild --platform android --no-install",
      "cd android && sh ./gradlew assembleRelease --no-daemon --console=plain",
    ]);
    expect(recipe.collect).toMatchObject({ platform: "android", root: "android/app/build/outputs/apk", patterns: ["**/release/**/*.apk"] });
    expect(recipe.cleanup).toContain("node_modules/.pnpm/*/node_modules/*/android/.cxx");
    expect(recipe.cleanup).toContain("android/app/build");
  });

  test("android with a native project skips prebuild and never leaves a Gradle daemon", () => {
    const recipe = recipeFor({ "android/gradlew": "", "android/app/build.gradle": "" }, "android-apk");
    expect(recipe.steps.map((step) => step.command)).toEqual(["cd android && sh ./gradlew assembleDebug --no-daemon --console=plain"]);
    expect(recipe.requires).toEqual(["java"]);
  });

  test.skipIf(!Bun.which("npx"))("npm's npx passes the binary and every flag through unchanged", async () => {
    const dir = makeTempDir("npx");
    writeFiles(dir, {
      "package.json": JSON.stringify({ devDependencies: { electron: "44", "electron-builder": "26" } }),
      "node_modules/.bin/electron-builder": '#!/bin/sh\necho "argv: $*"\n',
    });
    chmodSync(join(dir, "node_modules/.bin/electron-builder"), 0o755);
    const recipe = resolveRecipe({ facts: detectProject(dir), target: "electron-linux", profile: "debug", display: ":1" });
    const command = recipe.steps.at(-1)?.command ?? "";
    const binary = " electron-builder ";
    const proc = Bun.spawn(["bash", "-c", command], { cwd: dir, stdout: "pipe", stderr: "pipe", env: { ...process.env, npm_config_update_notifier: "false" } });
    const [stdout] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    expect(stdout.trim()).toBe(`argv: ${command.slice(command.indexOf(binary) + binary.length)}`);
  }, 30_000);

  test("undetected targets are rejected", () => {
    expect(() => recipeFor({ "package.json": "{}" }, "electron-linux")).toThrow("not available");
  });
});
