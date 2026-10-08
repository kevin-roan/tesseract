import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ApiError } from "@tesseract/client";
import type { Artifact, BuildJob, BuildTarget, LogLine, ProcessInfo, ServerEvent } from "@tesseract/protocol";
import { client, e2e, MINUTES, REPO_ROOT, SECONDS } from "./lib/env";
import { readPng, sha256 } from "./lib/bytes";
import { copyDirectory, exec, processesMatching, sandboxCli, sh } from "./lib/sandbox";
import { delay, recordEvents, waitFor, type EventRecorder } from "./lib/wait";

const PROJECT_ID = "electron-hello";
const PROJECT_DIR = `/workspace/projects/${PROJECT_ID}`;
const EXAMPLE_DIR = resolve(REPO_ROOT, "examples/electron-hello");
const WINDOW_TITLE = "Tesseract Electron Hello";
const BUILD_TIMEOUT_MS = 20 * MINUTES;
const SEEDED_CONTEXT = [
  "GLOBAL_CONTEXT.md",
  "ENVIRONMENT.md",
  "CURRENT_TASK.md",
  "DECISIONS.md",
  "COMMANDS.md",
  "SESSION_LOG.md",
  "RUNTIME.md",
];
const EXPECTED_ARTIFACTS: Record<string, { platform: string; fileName: RegExp }> = {
  "electron-linux": { platform: "linux", fileName: /^electron-hello-linux-debug-1\.0\.0(-\d+)?\.AppImage$/ },
  "electron-windows": { platform: "windows", fileName: /^electron-hello-windows-debug-1\.0\.0(-\d+)?\.exe$/ },
};

const builds = new Map<string, BuildJob>();
let recorder: EventRecorder;
let screenshotDir: string | undefined;

function saveScreenshot(name: string, data: ArrayBuffer): void {
  if (!screenshotDir) return;
  writeFileSync(join(screenshotDir, name), new Uint8Array(data));
}

function isBuildEvent(id: string, state: string) {
  return (event: ServerEvent) => event.type === "build.updated" && event.build.id === id && event.build.state === state;
}

async function runBuild(target: BuildTarget): Promise<{ build: BuildJob; lines: LogLine[]; stages: string[] }> {
  const started = await client.startBuild({ projectId: PROJECT_ID, target });
  expect(started).toMatchObject({ projectId: PROJECT_ID, target, profile: "debug" });
  const lines: LogLine[] = [];
  const stages: string[] = [];
  const connection = client.openBuildLogs(started.id, {
    onLine: (line) => lines.push(line),
    onBuild: (build) => {
      if (build.stage && stages.at(-1) !== build.stage) stages.push(build.stage);
    },
  });
  try {
    const final = await waitFor(
      `${target} build ${started.id}`,
      async () => {
        const build = await client.getBuild(started.id);
        return build.state === "queued" || build.state === "running" ? undefined : build;
      },
      BUILD_TIMEOUT_MS,
      2 * SECONDS,
    );
    if (final.state !== "succeeded") {
      const tail = (await client.buildLogs(started.id, { tail: 80 })).map((line) => line.text).join("\n");
      throw new Error(`${target} build ${final.state}: ${final.error}\n${tail}`);
    }
    await waitFor("build log stream to deliver the result", () => lines.some((line) => line.text.includes("Build succeeded")), 15 * SECONDS);
    return { build: final, lines, stages };
  } finally {
    connection.close();
  }
}

async function download(artifact: Artifact): Promise<void> {
  const url = await client.artifactDownloadUrl(artifact.id);
  const response = await fetch(url);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-disposition") ?? "").toContain("attachment");
  const body = await response.arrayBuffer();
  expect(body.byteLength).toBe(artifact.sizeBytes);
  expect(sha256(body)).toBe(artifact.sha256);
  const reused = await fetch(url);
  expect(reused.status).toBe(401);
}

beforeAll(async () => {
  recorder = await recordEvents();
  const dir = process.env.TESSERACT_E2E_SCREENSHOT_DIR;
  if (dir) {
    mkdirSync(dir, { recursive: true });
    screenshotDir = dir;
  }
});

afterAll(() => recorder.close());

describe("electron-hello project", () => {
  test(
    "create the project and copy the example in",
    async () => {
      try {
        const created = await client.createProject({ name: PROJECT_ID });
        expect(created.project.id).toBe(PROJECT_ID);
        expect(created.processId).toBeUndefined();
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 409)) throw error;
      }
      await copyDirectory(EXAMPLE_DIR, "/workspace/projects");
      const owner = await sh(`stat -c %U ${PROJECT_DIR}/package.json`);
      expect(owner.trim()).toBe("dev");

      const project = await client.getProject(PROJECT_ID);
      expect(project.framework).toBe("electron");
      expect(project.buildTargets).toEqual(expect.arrayContaining(["electron-linux", "electron-windows"]));
      expect(project.scripts).toEqual(expect.arrayContaining(["start", "build:linux", "build:win"]));
      expect(project.git?.branch).toBeTruthy();
      expect((await client.listProjects()).map((item) => item.id)).toContain(PROJECT_ID);
    },
    60 * SECONDS,
  );

  for (const target of ["electron-linux", "electron-windows"] as const) {
    test(
      `${target} build succeeds and its artifact downloads intact`,
      async () => {
        const { build, lines, stages } = await runBuild(target);
        builds.set(target, build);
        const expected = EXPECTED_ARTIFACTS[target];
        if (!expected) throw new Error(`no expectation for ${target}`);
        expect(build.artifacts).toHaveLength(1);
        const [artifact] = build.artifacts;
        if (!artifact) throw new Error("no artifact");
        expect(artifact.fileName).toMatch(expected.fileName);
        expect(artifact.platform).toBe(expected.platform);
        expect(artifact.path).toBe(`/workspace/artifacts/${artifact.fileName}`);
        expect(artifact.buildId).toBe(build.id);
        expect(artifact.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(stages).toEqual(expect.arrayContaining(["install", "package", "collect"]));
        expect(lines.length).toBeGreaterThan(5);

        await recorder.next(`${target} build.updated succeeded`, isBuildEvent(build.id, "succeeded"));
        await recorder.next(`${target} artifact.created`, (event) => event.type === "artifact.created" && event.artifact.id === artifact.id);
        expect(recorder.events.some(isBuildEvent(build.id, "running"))).toBe(true);

        const listed = await client.listArtifacts({ projectId: PROJECT_ID });
        expect(listed.find((item) => item.id === artifact.id)).toEqual(artifact);
        const inContainer = await sh(`sha256sum ${artifact.path}`);
        expect(inContainer.split(" ")[0]).toBe(artifact.sha256);
        await download(artifact);
      },
      BUILD_TIMEOUT_MS + MINUTES,
    );
  }
  test("git details ignore build output", async () => {
    const git = await client.getProjectGit(PROJECT_ID);
    expect(git.branch).toBeTruthy();
    const paths = git.files.map((file) => file.path);
    expect(paths).toContain("package.json");
    expect(paths.filter((path) => path.startsWith("node_modules") || path.startsWith("dist"))).toEqual([]);
  });
});

describe("GUI on the virtual display", () => {
  let gui: ProcessInfo | undefined;

  afterAll(async () => {
    if (gui) await client.stopProcess(gui.id).catch(() => undefined);
  });

  test(
    "the built AppImage renders a window, shows up in RUNTIME.md and stops cleanly",
    async () => {
      const artifact = builds.get("electron-linux")?.artifacts[0];
      if (!artifact) throw new Error("the electron-linux build did not produce an artifact");
      await waitFor("no electron window yet", async () => (await processesMatching("electron-hello")).length === 0, 20 * SECONDS);

      const before = await client.screenshot();
      const beforePng = readPng(before);
      expect(beforePng).toEqual({ width: 1600, height: 900 });
      saveScreenshot("display-before.png", before);

      gui = await client.startProcess({
        projectId: PROJECT_ID,
        name: "electron-hello-gui",
        command: [artifact.path, "--no-sandbox"],
        display: true,
      });
      expect(gui.display).toBe(true);
      const id = gui.id;
      await waitFor("the electron window", async () => {
        const result = await exec(["xdotool", "search", "--name", WINDOW_TITLE], { env: { DISPLAY: ":1" } });
        return result.code === 0 && result.stdout.trim().length > 0;
      }, 90 * SECONDS, SECONDS);
      await delay(3 * SECONDS);
      expect((await client.getProcess(id)).state).toBe("running");

      const after = await client.screenshot();
      expect(readPng(after)).toEqual(beforePng);
      saveScreenshot("display-electron.png", after);
      expect(sha256(after)).not.toBe(sha256(before));

      const runtime = await waitFor("RUNTIME.md to list the GUI process", async () => {
        const text = await sh("cat /workspace/.agent/RUNTIME.md");
        return text.includes(id) ? text : undefined;
      });
      expect(runtime).toContain("electron-hello-gui");
      expect(runtime).not.toContain(e2e.token);
      expect(runtime).not.toContain(e2e.vncPassword);

      const context = await client.context();
      const names = context.files.map((file) => file.name);
      expect(names).toEqual(expect.arrayContaining(SEEDED_CONTEXT));
      for (const file of context.files) {
        expect({ file: file.name, token: file.content.includes(e2e.token) }).toEqual({ file: file.name, token: false });
        expect({ file: file.name, password: file.content.includes(e2e.vncPassword) }).toEqual({ file: file.name, password: false });
      }
      expect(context.files.find((file) => file.name === "RUNTIME.md")?.content).toContain(id);

      const stopped = await client.stopProcess(id);
      expect(["stopped", "exited"]).toContain(stopped.state);
      const final = await waitFor("the GUI process to stop", async () => {
        const info = await client.getProcess(id);
        return info.state === "stopped" ? info : undefined;
      });
      expect(final.endedAt).not.toBeNull();
      gui = undefined;
      await waitFor("no electron processes left", async () => (await processesMatching("electron")).length === 0, 20 * SECONDS);
      const endedRow = new RegExp(`^\\| ${id} \\|.*\\| stopped \\|`, "m");
      await waitFor("RUNTIME.md to list the GUI process as stopped", async () => endedRow.test(await sh("cat /workspace/.agent/RUNTIME.md")));
    },
    3 * MINUTES,
  );
});

describe("restart resilience", () => {
  test(
    "state, credentials and the display survive a container restart; running processes end as stopped",
    async () => {
      const displayBefore = await client.displayStatus();
      const sleeper = await client.startProcess({ projectId: PROJECT_ID, name: "sleeper", command: "sleep 600" });
      await waitFor("sleeper running", async () => (await client.getProcess(sleeper.id)).state === "running");

      const startedAt = Date.now();
      await sandboxCli(["restart", "sandbox"]);
      await waitFor("health after restart", async () => (await client.health({ timeoutMs: 3 * SECONDS })).ok, 60 * SECONDS, SECONDS);
      console.log(`controller healthy ${Math.round((Date.now() - startedAt) / 1000)} s after the restart began`);

      const status = await client.status();
      expect(Date.parse(status.startedAt)).toBeGreaterThan(startedAt - 5 * SECONDS);
      const display = await waitFor("display after restart", async () => {
        const current = await client.displayStatus();
        return current.available && current.vnc.available ? current : undefined;
      }, 60 * SECONDS, SECONDS);
      expect(display.vnc.password).toBe(displayBefore.vnc.password);

      const listedBuilds = await client.listBuilds({ projectId: PROJECT_ID });
      for (const build of builds.values()) {
        expect(listedBuilds.find((item) => item.id === build.id)?.state).toBe("succeeded");
      }
      const artifacts = await client.listArtifacts();
      for (const build of builds.values()) {
        for (const artifact of build.artifacts) expect(artifacts.map((item) => item.id)).toContain(artifact.id);
      }

      const stopped = await client.getProcess(sleeper.id);
      expect(stopped.state).toBe("stopped");
      expect(stopped.endedAt).not.toBeNull();
      expect((await processesMatching("sleep 600")).length).toBe(0);

      const shot = await client.screenshot();
      expect(readPng(shot)).toEqual({ width: 1600, height: 900 });
      saveScreenshot("display-after-restart.png", shot);
    },
    3 * MINUTES,
  );
  test(
    "rows left running by a killed controller are marked orphaned",
    async () => {
      const sleeper = await client.startProcess({ projectId: PROJECT_ID, name: "orphan-sleeper", command: ["sleep", "601"] });
      await waitFor("sleeper running", async () => (await client.getProcess(sleeper.id)).state === "running");
      const before = await client.status();

      await exec(["pkill", "-KILL", "-f", "^/usr/local/bin/tesseract-controller serve"], { user: "root" });
      await waitFor(
        "a new controller instance",
        async () => (await client.status({ timeoutMs: 3 * SECONDS })).startedAt !== before.startedAt,
        60 * SECONDS,
        SECONDS,
      );
      const orphan = await client.getProcess(sleeper.id);
      expect(orphan.state).toBe("orphaned");
      expect(orphan.endedAt).not.toBeNull();
      expect((await client.listProcesses({ projectId: PROJECT_ID })).some((item) => item.state === "running")).toBe(false);
      await exec(["pkill", "-f", "^sleep 601$"]);
    },
    2 * MINUTES,
  );
});
