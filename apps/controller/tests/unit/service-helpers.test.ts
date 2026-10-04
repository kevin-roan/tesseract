import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgentStreamParser, summarizeToolInput, toEvent, truncate } from "../../src/services/agent-stream";
import { claudeArgs } from "../../src/services/agent-runs";
import { artifactExtension, artifactFileName, sanitizeVersion, sha256File } from "../../src/services/artifacts";
import { resolveRecipe } from "../../src/services/build-recipes";
import { confidentialPrompt } from "../../src/services/confidential";
import { parseDimensions, x11Socket } from "../../src/services/display";
import { filterDrivers, neutralConfig, parseStatus } from "../../src/services/git";
import { commandArgv, describeCommand } from "../../src/services/processes";
import { detectProject, PACKAGE_JSON_MAX_BYTES, type ProjectFacts } from "../../src/services/project-detect";
import { trimScrollback } from "../../src/services/terminals";
import { defaultProbes, extractVersion, ToolService } from "../../src/services/tools";
import { makeTempDir, removeTempDirs, writeFiles } from "../helpers";

afterEach(removeTempDirs);

describe("agent stream parser", () => {
  test("ignores non-JSON, arrays and unknown types without a session", () => {
    const parser = new AgentStreamParser();
    for (const line of ["", "plain text", "{broken", "[1,2]", "null", '{"type":"future_thing"}']) {
      expect(parser.parseLine(line)).toBeNull();
    }
    expect(parser.parseLine('{"type":"future_thing","session_id":"s1"}')).toEqual({ events: [], sessionId: "s1" });
  });

  test("system init describes the session; other subtypes only carry the session id", () => {
    const parser = new AgentStreamParser();
    expect(parser.parseMessage({ type: "system", subtype: "init", model: "opus", cwd: "/w", session_id: "s" })).toEqual({
      events: [{ kind: "system", text: "Session started (model opus, cwd /w)" }],
      sessionId: "s",
    });
    expect(parser.parseMessage({ type: "system", subtype: "init" })?.events).toEqual([{ kind: "system", text: "Session started" }]);
    expect(parser.parseMessage({ type: "system", subtype: "compact", session_id: "s" })).toEqual({ events: [], sessionId: "s" });
  });

  test("assistant text and tool use; tool results are matched to their tool", () => {
    const parser = new AgentStreamParser();
    const assistant = parser.parseMessage({
      type: "assistant",
      message: {
        content: [
          { type: "text", text: "Working on it" },
          { type: "text", text: "   " },
          { type: "thinking", thinking: "hidden" },
          "not a block",
          { type: "tool_use", id: "t1", name: "Bash", input: { command: "ls   -la" } },
          { type: "tool_use", input: {} },
        ],
      },
    });
    expect(assistant?.events).toEqual([
      { kind: "text", text: "Working on it" },
      { kind: "tool_use", tool: "Bash", summary: "ls -la" },
      { kind: "tool_use", tool: "tool", summary: "{}" },
    ]);
    const results = parser.parseMessage({
      type: "user",
      message: {
        content: [
          { type: "tool_result", tool_use_id: "t1", is_error: true, content: [{ type: "text", text: "no such file" }, { type: "image" }] },
          { type: "tool_result", tool_use_id: "unknown", content: "plain" },
          { type: "tool_result", content: 42 },
          { type: "text", text: "ignored" },
        ],
      },
    });
    expect(results?.events).toEqual([
      { kind: "tool_result", tool: "Bash", isError: true, summary: "no such file" },
      { kind: "tool_result", tool: null, isError: false, summary: "plain" },
      { kind: "tool_result", tool: null, isError: false, summary: "" },
    ]);
    expect(parser.parseMessage({ type: "assistant", message: "weird" })?.events).toEqual([]);
    expect(parser.parseMessage({ type: "user" })?.events).toEqual([]);
  });

  test("results: success, error subtypes and optional metrics", () => {
    const parser = new AgentStreamParser();
    expect(
      parser.parseMessage({ type: "result", subtype: "success", result: "done", duration_ms: 1500, num_turns: 3,
        usage: { input_tokens: 10, output_tokens: 2000, cache_read_input_tokens: 10000, cache_creation_input_tokens: 335, server_tool_use: {} },
      }),
    ).toEqual({
      sessionId: undefined,
      events: [{ kind: "system", text: "Run finished in 1.5 s, 3 turns, 12,345 tokens" }],
      result: {
        isError: false,
        result: "done",
        usage: { inputTokens: 10, outputTokens: 2000, cacheReadTokens: 10000, cacheWriteTokens: 335, totalTokens: 12345 },
        subtype: "success",
      },
    });
    expect(parser.parseMessage({ type: "result", subtype: "error_max_turns" })?.result).toEqual({
      isError: true,
      result: null,
      usage: null,
      subtype: "error_max_turns",
    });
    expect(parser.parseMessage({ type: "result", is_error: true })?.events[0]).toEqual({ kind: "system", text: "Run failed (error)" });
    expect(parser.parseMessage({ type: "result" })?.result?.isError).toBe(false);
  });

  test("summaries and truncation", () => {
    expect(truncate("a\n b\t c")).toBe("a b c");
    expect(truncate("abcdef", 4)).toBe("abc…");
    expect(summarizeToolInput("TodoWrite", { todos: [1, 2] })).toBe("2 todos");
    expect(summarizeToolInput("Read", { file_path: "/x", command: "" })).toBe("/x");
    expect(summarizeToolInput("Other", { command: "", other: 1 })).toBe('{"command":"","other":1}');
    expect(summarizeToolInput("Other", "string input")).toBe("");
    expect(summarizeToolInput("Other", [1])).toBe("");
    expect(toEvent({ kind: "text", text: "t" }, 4, "ts")).toEqual({ kind: "text", text: "t", seq: 4, ts: "ts" });
  });

  test("claudeArgs keeps the prompt out of argv", () => {
    expect(claudeArgs("--help", "plan")).toEqual({
      argv: ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "plan"],
      stdin: "--help",
    });
    expect(claudeArgs("x", "plan", { resumeSessionId: "abc-123" }).argv.slice(-2)).toEqual(["--resume", "abc-123"]);
  });

  test("claudeArgs appends the confidential system prompt before --resume", () => {
    const prompt = confidentialPrompt("morning-cat");
    expect(prompt).toContain('known only by the pseudonym "morning-cat"');
    expect(prompt).toContain("Write REDACTED in their place");
    expect(prompt).toContain("`theone-controller share` is disabled");
    expect(claudeArgs("x", "plan", { appendSystemPrompt: prompt, resumeSessionId: "s1" })).toEqual({
      argv: ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "plan", "--append-system-prompt", prompt, "--resume", "s1"],
      stdin: "x",
    });
  });

  test("claudeArgs adds the uploads dir and lists readable attachments, never audio", () => {
    const upload = { name: "a", sizeBytes: 1, createdAt: "2024-01-01T00:00:00.000Z" };
    const image = { ...upload, id: "upl_image00000", kind: "image" as const, mimeType: "image/png", path: "/w/.theone/uploads/upl_image00000/a.png" };
    const pdf = { ...upload, id: "upl_pdf0000000", kind: "pdf" as const, mimeType: "application/pdf", path: "/w/.theone/uploads/upl_pdf0000000/b.pdf" };
    const voice = { ...upload, id: "upl_voice00000", kind: "audio" as const, mimeType: "audio/mp4", path: "/w/.theone/uploads/upl_voice00000/c.m4a" };
    expect(claudeArgs("look", "acceptEdits", { attachments: [image, voice, pdf], uploadsDir: "/w/.theone/uploads", resumeSessionId: "s1" })).toEqual({
      argv: ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits", "--add-dir", "/w/.theone/uploads", "--resume", "s1"],
      stdin: [
        "look",
        "",
        "Attached files (read them with the Read tool):",
        "- /w/.theone/uploads/upl_image00000/a.png (image/png)",
        "- /w/.theone/uploads/upl_pdf0000000/b.pdf (application/pdf)",
      ].join("\n"),
    });
    expect(claudeArgs("hear", "plan", { attachments: [voice], uploadsDir: "/w/.theone/uploads" })).toEqual({
      argv: ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "plan"],
      stdin: "hear",
    });
  });
});

describe("git parsing", () => {
  test("parseStatus handles ordinary, renamed, unmerged, untracked, ignored and detached entries", () => {
    const output = [
      "# branch.oid abc",
      "# branch.head (detached)",
      "1 .M N... 100644 100644 100644 aaa bbb path with spaces.txt",
      "2 R. N... 100644 100644 100644 aaa bbb R100 new name.txt",
      "old name.txt",
      "u UU N... 100644 100644 100644 100644 aaa bbb ccc conflict.txt",
      "? untracked.txt",
      "! ignored.txt",
      "",
    ].join("\0");
    expect(parseStatus(output)).toEqual({
      branch: null,
      ahead: 0,
      behind: 0,
      files: [
        { path: "path with spaces.txt", index: " ", worktree: "M" },
        { path: "new name.txt", index: "R", worktree: " " },
        { path: "conflict.txt", index: "U", worktree: "U" },
        { path: "untracked.txt", index: "?", worktree: "?" },
      ],
    });
    expect(parseStatus("# branch.head main\0# branch.ab +2 -5\0")).toEqual({ branch: "main", ahead: 2, behind: 5, files: [] });
    expect(parseStatus("# branch.ab garbage\0")).toMatchObject({ ahead: 0, behind: 0 });
    expect(parseStatus("")).toEqual({ branch: null, ahead: 0, behind: 0, files: [] });
  });

  test("filter drivers are neutralized by name", () => {
    expect(filterDrivers("filter.lfs.clean\0filter.lfs.smudge\0filter.x.y.process\0core.editor\0filter.bad\0")).toEqual(["lfs", "x.y"]);
    const config = neutralConfig(["lfs"]);
    expect(config).toContain("filter.lfs.clean=");
    expect(config).toContain("filter.lfs.required=false");
    expect(config).toContain("core.fsmonitor=false");
    expect(neutralConfig([])).toHaveLength(4);
  });
});

describe("project detection", () => {
  function detect(files: Record<string, string>): ProjectFacts {
    const dir = makeTempDir("detect");
    writeFiles(dir, files);
    return detectProject(dir);
  }

  test("frameworks by dependency, in priority order", () => {
    const pkg = (deps: Record<string, string>, dev: Record<string, string> = {}) =>
      JSON.stringify({ dependencies: deps, devDependencies: dev });
    expect(detect({ "package.json": pkg({ next: "1", "react-native": "1" }) }).framework).toBe("react-native");
    expect(detect({ "package.json": pkg({ next: "1" }) }).framework).toBe("next");
    expect(detect({ "package.json": pkg({}, { vite: "1" }) }).framework).toBe("vite");
    expect(detect({ "package.json": pkg({ electron: "1", expo: "1" }) }).framework).toBe("electron");
    expect(detect({ "package.json": pkg({ lodash: "1" }) }).framework).toBe("node");
  });

  test("non-node projects", () => {
    expect(detect({ "build.gradle.kts": "" }).framework).toBe("android");
    expect(detect({ "android/.keep": "" }).framework).toBe("android");
    expect(detect({ Pipfile: "" }).framework).toBe("python");
    expect(detect({ "README.md": "" })).toMatchObject({ framework: "unknown", pkg: null, packageManager: null, buildTargets: [] });
  });

  test("package manager from lockfiles first, then the packageManager field", () => {
    expect(detect({ "package.json": "{}", "pnpm-lock.yaml": "", "yarn.lock": "" }).packageManager).toBe("pnpm");
    expect(detect({ "package.json": "{}", "bun.lockb": "" }).packageManager).toBe("bun");
    expect(detect({ "package.json": JSON.stringify({ packageManager: "yarn@4.1.0" }) }).packageManager).toBe("yarn");
    expect(detect({ "package.json": JSON.stringify({ packageManager: "deno@2" }) }).packageManager).toBeNull();
    expect(detect({ "package.json": JSON.stringify({ packageManager: 7 }) }).packageManager).toBeNull();
  });

  test("malformed package.json content degrades to an empty package", () => {
    for (const content of ["[1,2]", "not json", "null", '"str"']) {
      expect(detect({ "package.json": content })).toMatchObject({ pkg: {}, framework: "node", scripts: [] });
    }
    const odd = detect({ "package.json": JSON.stringify({ scripts: { build: 1, test: "t" }, dependencies: ["x"] }) });
    expect(odd.scripts).toEqual(["test"]);
    expect(odd.deps.size).toBe(0);
    expect(odd.buildTargets).toEqual([]);
  });

  test("oversized or non-regular package.json is ignored", () => {
    const dir = makeTempDir("detect");
    writeFileSync(join(dir, "package.json"), `{"name":"${"x".repeat(PACKAGE_JSON_MAX_BYTES)}"}`);
    expect(detectProject(dir).pkg).toEqual({});
    const other = makeTempDir("detect");
    mkdirSync(join(other, "package.json"));
    expect(detectProject(other).pkg).toEqual({});
  });

  test("build targets", () => {
    const expo = detect({ "package.json": JSON.stringify({ dependencies: { expo: "1" } }) });
    expect(expo.buildTargets).toEqual([]);
    const expoApp = detect({ "package.json": JSON.stringify({ dependencies: { expo: "1" } }), "app.config.ts": "" });
    expect(expoApp.buildTargets).toEqual(["android-apk"]);
    const native = detect({ "android/gradlew": "" });
    expect(native.buildTargets).toEqual(["android-apk"]);
    const nativeWithoutWrapper = detect({ "android/build.gradle": "" });
    expect(nativeWithoutWrapper.buildTargets).toEqual([]);
    const electron = detect({ "package.json": JSON.stringify({ devDependencies: { "@electron-forge/cli": "1" }, scripts: { build: "tsc" } }) });
    expect(electron).toMatchObject({ electronTool: "electron-forge", buildTargets: ["electron-linux", "electron-windows", "script"] });
    const web = detect({ "package.json": JSON.stringify({ scripts: { build: "vite build" } }) });
    expect(web.buildTargets).toEqual(["web", "script"]);
  });
});

describe("build recipes", () => {
  function facts(overrides: Partial<ProjectFacts>): ProjectFacts {
    return {
      pkg: {},
      deps: new Set(),
      framework: "node",
      packageManager: null,
      scripts: [],
      buildTargets: [],
      electronTool: null,
      hasAndroidDir: false,
      ...overrides,
    };
  }

  test("script target defaults to npm and skips install without dependencies", () => {
    const recipe = resolveRecipe({ facts: facts({ buildTargets: ["script"] }), target: "script", profile: "debug", display: ":1" });
    expect(recipe).toEqual({ steps: [{ stage: "compile", command: "npm run build" }], env: {}, requires: [], collect: null });
  });

  test("web target zips the first existing output dir", () => {
    const recipe = resolveRecipe({
      facts: facts({ buildTargets: ["web"], deps: new Set(["vite"]), packageManager: "pnpm" }),
      target: "web",
      profile: "release",
      display: ":1",
    });
    expect(recipe.steps.map((step) => step.command)).toEqual(["pnpm install", "pnpm run build"]);
    expect(recipe.collect).toEqual({ kind: "zip", platform: "web", candidates: ["dist", "build", "out", "web-build"] });
  });

  test("electron-builder honours a custom output dir, skips a build script that packages, and release keeps compression", () => {
    const recipe = resolveRecipe({
      facts: facts({
        pkg: { scripts: { build: "electron-builder --linux" }, build: { directories: { output: " release " } } },
        deps: new Set(["electron-builder"]),
        packageManager: "yarn",
        electronTool: "electron-builder",
        buildTargets: ["electron-linux"],
      }),
      target: "electron-linux",
      profile: "release",
      display: ":1",
    });
    expect(recipe.steps.map((step) => step.command)).toEqual(["yarn install", "yarn run electron-builder --linux AppImage --x64 --publish never"]);
    expect(recipe.collect).toMatchObject({ kind: "files", root: "release", platform: "linux" });
    expect(recipe.env).toEqual({});
  });

  test("windows builds get a wine environment from the given env", () => {
    const recipe = resolveRecipe({
      facts: facts({ electronTool: "electron-forge", deps: new Set(["@electron-forge/cli"]), buildTargets: ["electron-windows"], packageManager: "bun" }),
      target: "electron-windows",
      profile: "debug",
      display: ":7",
      env: { WINEPREFIX: "/tmp/wp", HOME: "/home/x" },
    });
    expect(recipe.env).toMatchObject({ WINEPREFIX: "/tmp/wp", DISPLAY: ":7", WINEARCH: "win64" });
    expect(recipe.requires).toEqual(["wine"]);
    expect(recipe.steps.at(-1)?.command).toBe("bunx --no-install electron-forge make --platform win32 --arch x64");
    const noPrefix = resolveRecipe({
      facts: facts({ electronTool: "electron-builder", buildTargets: ["electron-windows"] }),
      target: "electron-windows",
      profile: "debug",
      display: ":1",
      env: { HOME: "/home/x" },
    });
    expect(noPrefix.env.WINEPREFIX).toBe("/home/x/.wine");
    expect(noPrefix.collect).toMatchObject({ root: "dist", patterns: ["*.exe"] });
  });

  test("android takes SDK and Java locations from the env", () => {
    const recipe = resolveRecipe({
      facts: facts({ buildTargets: ["android-apk"], hasAndroidDir: true }),
      target: "android-apk",
      profile: "release",
      display: ":1",
      env: { ANDROID_SDK_ROOT: "/sdk", JAVA_HOME: "/jdk" },
    });
    expect(recipe.env).toEqual({ ANDROID_HOME: "/sdk", ANDROID_SDK_ROOT: "/sdk", JAVA_HOME: "/jdk" });
    expect(recipe.steps).toEqual([{ stage: "package", command: "cd android && sh ./gradlew assembleRelease --no-daemon --console=plain" }]);
    expect(recipe.collect).toMatchObject({ patterns: ["**/release/**/*.apk"] });
  });

  test("unavailable targets list what was detected", () => {
    expect(() => resolveRecipe({ facts: facts({}), target: "web", profile: "debug", display: ":1" })).toThrow("(detected: none)");
    expect(() => resolveRecipe({ facts: facts({ buildTargets: ["script"] }), target: "web", profile: "debug", display: ":1" })).toThrow(
      "(detected: script)",
    );
  });
});

describe("artifact naming", () => {
  test("extensions, versions and collision suffixes", () => {
    expect(artifactExtension("app.tar.gz")).toBe(".tar.gz");
    expect(artifactExtension("app.tar.zst")).toBe(".tar.zst");
    expect(artifactExtension("App Setup 1.0.exe")).toBe(".exe");
    expect(artifactExtension("noext")).toBe("");
    expect(sanitizeVersion(" 1.2.3-beta+4 ")).toBe("1.2.3-beta+4");
    expect(sanitizeVersion("v1 / 2")).toBe("v1-2");
    expect(sanitizeVersion("///")).toBe("0.0.0");
    expect(sanitizeVersion(undefined)).toBe("0.0.0");
    const meta = { projectId: "app", buildId: null, platform: "web", profile: "debug" as const, version: "1.0" };
    expect(artifactFileName(meta, ".zip", 1)).toBe("app-web-debug-1.0.zip");
    expect(artifactFileName(meta, ".zip", 3)).toBe("app-web-debug-1.0-3.zip");
  });

  test("sha256File hashes streamed content", async () => {
    const dir = makeTempDir("sha");
    writeFileSync(join(dir, "f"), "abc");
    expect(await sha256File(join(dir, "f"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("processes and terminals helpers", () => {
  test("commandArgv and describeCommand", () => {
    expect(commandArgv("echo hi")).toEqual(["bash", "-lc", "echo hi"]);
    expect(commandArgv(["node", "x.js"])).toEqual(["node", "x.js"]);
    expect(describeCommand(["node", "--port=3000", "a b", "", "it's"])).toBe(`node --port=3000 "a b" "" "it's"`);
    expect(describeCommand("npm run dev")).toBe("npm run dev");
  });

  test("trimScrollback only jumps to a newline that is close", () => {
    const far = [`${"a".repeat(10)}${"b".repeat(5000)}\nrest`];
    const size = Buffer.byteLength(far[0] ?? "");
    const remaining = trimScrollback(far, size, size - 10);
    expect(remaining).toBe(size - 10);
    expect(far[0]).toStartWith("bbbb");

    const near = [`${"a".repeat(10)}xyz\nrest`];
    const nearSize = Buffer.byteLength(near[0] ?? "");
    expect(trimScrollback(near, nearSize, nearSize - 5)).toBe(4);
    expect(near).toEqual(["rest"]);

    const untouched = ["abc"];
    expect(trimScrollback(untouched, 3, 10)).toBe(3);
    expect(trimScrollback([], 50, 10)).toBe(50);
  });
});

describe("tools", () => {
  test("extractVersion finds the first dotted version", () => {
    expect(extractVersion("v22.3.0")).toBe("22.3.0");
    expect(extractVersion('openjdk version "21.0.2" 2024-01-16')).toBe("21.0.2");
    expect(extractVersion("wine-9.0-rc1")).toBe("9.0-rc1");
    expect(extractVersion("Python 3.12.1\n")).toBe("3.12.1");
    expect(extractVersion("no version\nsecond line 1.2")).toBe("1.2");
    expect(extractVersion("version 7")).toBeNull();
  });

  test("defaultProbes cover the sandbox toolchain and use the configured claude", () => {
    const probes = defaultProbes("/opt/claude");
    expect(probes.map((probe) => probe.name)).toEqual(["node", "bun", "git", "python3", "java", "wine", "claude", "adb"]);
    expect(probes.find((probe) => probe.name === "claude")?.bin).toBe("/opt/claude");
  });

  test("ToolService probes once; missing, failing and silent tools have no version", async () => {
    const dir = makeTempDir("tools");
    writeFiles(dir, { "fails.sh": "#!/bin/sh\necho 'fails 1.0'\nexit 3\n", "stderr.sh": "#!/bin/sh\necho 'java 17.0.1' >&2\n" });
    Bun.spawnSync(["chmod", "+x", join(dir, "fails.sh"), join(dir, "stderr.sh")]);
    symlinkSync("/nonexistent/binary", join(dir, "dangling"));
    const tools = new ToolService([
      { name: "bash", bin: "bash", args: ["--version"] },
      { name: "missing", bin: "definitely-missing-tool", args: [] },
      { name: "empty", bin: "", args: [] },
      { name: "fails", bin: join(dir, "fails.sh"), args: [] },
      { name: "stderr", bin: join(dir, "stderr.sh"), args: [] },
      { name: "silent", bin: "true", args: [] },
    ]);
    const list = await tools.list();
    expect(list.find((tool) => tool.name === "bash")?.version).toMatch(/^\d+\.\d+/);
    expect(list.filter((tool) => tool.version === null).map((tool) => tool.name)).toEqual(["missing", "empty", "silent"]);
    expect(list.find((tool) => tool.name === "fails")?.version).toBe("1.0");
    expect(list.find((tool) => tool.name === "stderr")?.version).toBe("17.0.1");
    expect(await tools.has("bash")).toBe(true);
    expect(await tools.has("missing")).toBe(false);
    expect(await tools.has("nope")).toBe(false);
    expect(await tools.list()).toBe(list);
  });
});

describe("display parsing", () => {
  test("parseDimensions and x11Socket", () => {
    expect(parseDimensions("screen #0:\n  dimensions:    1920x1080 pixels (508x285 millimeters)")).toEqual({ width: 1920, height: 1080 });
    expect(parseDimensions("no screens")).toBeNull();
    expect(x11Socket(":0")).toBe("/tmp/.X11-unix/X0");
    expect(x11Socket(":12.1")).toBe("/tmp/.X11-unix/X12");
    expect(x11Socket("remote:1")).toBeNull();
  });
});
