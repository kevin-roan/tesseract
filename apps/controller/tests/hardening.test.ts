import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  AgentRunDetailSchema,
  BuildJobSchema,
  LogLineListSchema,
  ProcessInfoSchema,
  ProjectListSchema,
  TerminalInfoSchema,
  TerminalServerMessageSchema,
} from "@theone/protocol";
import { loadConfig } from "../src/config";
import { mirrorTokenToFile, readTokenFile, resolveToken } from "../src/auth/token";
import { childEnv, CONTROLLER_SECRET_ENV } from "../src/core/exec";
import { readRegularFile } from "../src/core/files";
import { readAgentContext } from "../src/services/context";
import { filterDrivers, neutralConfig } from "../src/services/git";
import { detectProject, PACKAGE_JSON_MAX_BYTES } from "../src/services/project-detect";
import { makeTempDir, removeTempDirs, startTestController, TEST_TOKEN, waitFor, writeFiles, type TestController } from "./helpers";

const SECRETS = { THEONE_TOKEN: "leaky-token-value", THEONE_VNC_PASSWORD: "leaky-vnc" };
const saved: Record<string, string | undefined> = {};

function mkfifo(path: string): void {
  const result = Bun.spawnSync(["mkfifo", path]);
  if (result.exitCode !== 0) throw new Error(`mkfifo failed: ${result.stderr.toString()}`);
}

function git(dir: string, ...args: string[]): void {
  const result = Bun.spawnSync(["git", "-C", dir, "-c", "user.email=t@example.test", "-c", "user.name=t", ...args]);
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString()}`);
}

function timed<T>(run: () => T): { value: T; ms: number } {
  const started = performance.now();
  const value = run();
  return { value, ms: performance.now() - started };
}

describe("bounded reads of project and agent files", () => {
  test("readRegularFile refuses devices, FIFOs and directories without blocking", () => {
    const dir = makeTempDir("files");
    const fifo = join(dir, "pipe");
    mkfifo(fifo);
    const { value, ms } = timed(() => [
      readRegularFile("/dev/zero", { maxBytes: 1024, followSymlinks: true }),
      readRegularFile(fifo, { maxBytes: 1024, followSymlinks: true }),
      readRegularFile(dir, { maxBytes: 1024, followSymlinks: true }),
    ]);
    expect(value).toEqual([null, null, null]);
    expect(ms).toBeLessThan(1_000);
  });

  test("readRegularFile honours the size cap and symlink policy", () => {
    const dir = makeTempDir("files");
    writeFileSync(join(dir, "big.txt"), "x".repeat(100));
    symlinkSync(join(dir, "big.txt"), join(dir, "link.txt"));
    expect(readRegularFile(join(dir, "big.txt"), { maxBytes: 10 })).toBeNull();
    expect(readRegularFile(join(dir, "big.txt"), { maxBytes: 10, truncate: true })).toEqual({ content: "x".repeat(10), sizeBytes: 100, truncated: true });
    expect(readRegularFile(join(dir, "link.txt"), { maxBytes: 1_000 })).toBeNull();
    expect(readRegularFile(join(dir, "link.txt"), { maxBytes: 1_000, followSymlinks: true })?.content).toBe("x".repeat(100));
  });

  test("a package.json that is a device, a FIFO or oversized is ignored quickly", () => {
    const root = makeTempDir("detect");
    const zero = join(root, "zero");
    const random = join(root, "random");
    const fifo = join(root, "fifo");
    const huge = join(root, "huge");
    for (const dir of [zero, random, fifo, huge]) mkdirSync(dir);
    symlinkSync("/dev/zero", join(zero, "package.json"));
    symlinkSync("/dev/urandom", join(random, "package.json"));
    mkfifo(join(fifo, "package.json"));
    writeFileSync(join(huge, "package.json"), JSON.stringify({ name: "huge", pad: "x".repeat(PACKAGE_JSON_MAX_BYTES) }));
    const { value, ms } = timed(() => [zero, random, fifo, huge].map((dir) => detectProject(dir)));
    expect(ms).toBeLessThan(1_000);
    for (const facts of value) {
      expect(facts.pkg).toEqual({});
      expect(facts.framework).toBe("node");
      expect(facts.buildTargets).toEqual([]);
    }
  });

  test("a regular package.json, symlinked or not, is still read", () => {
    const root = makeTempDir("detect");
    writeFiles(root, { "shared/package.json": JSON.stringify({ name: "shared", scripts: { build: "true" } }) });
    mkdirSync(join(root, "app"));
    symlinkSync(join(root, "shared", "package.json"), join(root, "app", "package.json"));
    expect(detectProject(join(root, "app")).pkg?.name).toBe("shared");
    expect(detectProject(join(root, "shared")).scripts).toEqual(["build"]);
  });

  test("agent context skips FIFOs and symlinks and caps content", () => {
    const agentDir = makeTempDir("context");
    writeFiles(agentDir, { "NOTES.md": "n".repeat(50), "projects/app/STATE.md": "state\n" });
    mkfifo(join(agentDir, "PIPE.md"));
    symlinkSync("/dev/zero", join(agentDir, "ZERO.md"));
    const { value, ms } = timed(() => readAgentContext(agentDir, 10));
    expect(ms).toBeLessThan(1_000);
    expect(value.files.map((file) => [file.name, file.content, file.truncated])).toEqual([
      ["NOTES.md", "n".repeat(10), true],
      ["projects/app/STATE.md", "state\n", false],
    ]);
  });

  test("the controller keeps answering while it lists a project whose package.json points at /dev/urandom", async () => {
    const workspace = makeTempDir("detect-ws");
    mkdirSync(join(workspace, "projects", "evil"), { recursive: true });
    symlinkSync("/dev/urandom", join(workspace, "projects", "evil", "package.json"));
    const t = await startTestController({ workspace });
    try {
      const started = performance.now();
      const { status, body } = await t.json("GET", "/v1/projects");
      expect(status).toBe(200);
      expect(performance.now() - started).toBeLessThan(3_000);
      expect(ProjectListSchema.parse(body).map((project) => project.id)).toEqual(["evil"]);
    } finally {
      await t.stop();
    }
  });
});

describe("untrusted git configuration", () => {
  let t: TestController;
  let proofDir: string;

  beforeAll(async () => {
    const workspace = makeTempDir("git-ws");
    proofDir = makeTempDir("git-proof");
    const dir = join(workspace, "projects", "unpacked");
    mkdirSync(dir, { recursive: true });
    git(dir, "init", "-q");
    writeFileSync(join(dir, "a.txt"), "hello\n");
    git(dir, "add", "a.txt");
    git(dir, "commit", "-q", "-m", "first");
    writeFileSync(join(dir, ".gitattributes"), "* filter=evil\n");
    mkdirSync(join(dir, ".git", "info"), { recursive: true });
    writeFileSync(join(dir, ".git", "info", "attributes"), "* filter=other.name\n");
    const touch = (name: string) => `touch ${join(proofDir, name)}`;
    git(dir, "config", "core.fsmonitor", `${touch("fsmonitor")}; false`);
    git(dir, "config", "filter.evil.clean", `sh -c '${touch("clean")}; cat'`);
    git(dir, "config", "filter.evil.required", "true");
    git(dir, "config", "filter.other.name.process", touch("process"));
    git(dir, "config", "log.showSignature", "true");
    git(dir, "config", "gpg.program", touch("gpg"));
    const past = new Date("2001-01-01T00:00:00Z");
    Bun.spawnSync(["touch", "-d", past.toISOString(), join(dir, "a.txt")]);
    t = await startTestController({ workspace });
  });

  afterAll(async () => {
    await t.stop();
  });

  test("project listing and git details never run repository-configured programs", async () => {
    const list = await t.json("GET", "/v1/projects");
    expect(list.status).toBe(200);
    const [project] = ProjectListSchema.parse(list.body);
    expect(project?.git?.lastCommit?.subject).toBe("first");
    const details = await t.json<{ log: { subject: string }[] }>("GET", "/v1/projects/unpacked/git");
    expect(details.status).toBe(200);
    expect(details.body.log.map((commit) => commit.subject)).toEqual(["first"]);
    for (const name of ["fsmonitor", "clean", "process", "gpg"]) expect(existsSync(join(proofDir, name))).toBe(false);
  });

  test("filterDrivers and neutralConfig", () => {
    expect(filterDrivers("filter.lfs.clean\0filter.lfs.smudge\0filter.a.b.process\0filter.x.required\0core.bare\0")).toEqual(["lfs", "a.b"]);
    expect(neutralConfig(["lfs"])).toEqual([
      "-c", "core.fsmonitor=false",
      "-c", "log.showSignature=false",
      "-c", "filter.lfs.clean=",
      "-c", "filter.lfs.smudge=",
      "-c", "filter.lfs.process=",
      "-c", "filter.lfs.required=false",
    ]);
  });
});

describe("controller secrets stay out of child environments", () => {
  let t: TestController;
  let claudeBin: string;

  beforeAll(async () => {
    for (const [name, value] of Object.entries(SECRETS)) {
      saved[name] = process.env[name];
      process.env[name] = value;
    }
    const bin = makeTempDir("env-bin");
    claudeBin = join(bin, "claude");
    const result = '{"type":"result","subtype":"success","is_error":false,"result":"token=${THEONE_TOKEN:-absent} vnc=${THEONE_VNC_PASSWORD:-absent}","session_id":"s1"}';
    writeFileSync(claudeBin, `#!/usr/bin/env bash\ncat > /dev/null\necho "${result.replaceAll('"', '\\"')}"\n`);
    chmodSync(claudeBin, 0o755);
    const workspace = makeTempDir("env-ws");
    writeFiles(workspace, {
      "projects/app/package.json": JSON.stringify({ name: "app", scripts: { build: "echo token=${THEONE_TOKEN:-absent} vnc=${THEONE_VNC_PASSWORD:-absent}" } }),
    });
    t = await startTestController({ workspace, env: { THEONE_CLAUDE_BIN: claudeBin } });
  });

  afterAll(async () => {
    await t.stop();
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  const clean = "token=absent vnc=absent";

  test("childEnv drops exactly the controller secrets", () => {
    expect(CONTROLLER_SECRET_ENV).toEqual(["THEONE_TOKEN", "THEONE_VNC_PASSWORD", "THEONE_STT_API_KEY", "GEMINI_API_KEY"]);
    expect(childEnv({ THEONE_TOKEN: "a", THEONE_VNC_PASSWORD: "b", THEONE_PORT: "7700", PATH: "/bin" })).toEqual({ THEONE_PORT: "7700", PATH: "/bin" });
  });

  test("processes", async () => {
    const { body } = await t.json("POST", "/v1/processes", { projectId: "app", command: "echo token=${THEONE_TOKEN:-absent} vnc=${THEONE_VNC_PASSWORD:-absent}" });
    const { id } = ProcessInfoSchema.parse(body);
    const lines = await waitFor(async () => {
      const logs = LogLineListSchema.parse((await t.json("GET", `/v1/processes/${id}/logs`)).body);
      return logs.some((line) => line.text.startsWith("token=")) ? logs : null;
    });
    expect(lines.find((line) => line.text.startsWith("token="))?.text).toBe(clean);
  });

  test("builds", async () => {
    const { body } = await t.json("POST", "/v1/builds", { projectId: "app", target: "script" });
    const { id } = BuildJobSchema.parse(body);
    await waitFor(async () => BuildJobSchema.parse((await t.json("GET", `/v1/builds/${id}`)).body).endedAt, 15_000);
    const logs = LogLineListSchema.parse((await t.json("GET", `/v1/builds/${id}/logs`)).body);
    expect(logs.find((line) => line.text.startsWith("token="))?.text).toBe(clean);
  });

  test("terminals", async () => {
    const { body } = await t.json("POST", "/v1/terminals", { kind: "shell", cols: 120, rows: 24 });
    const info = TerminalInfoSchema.parse(body);
    const socket = await t.socket(`/v1/terminals/${info.id}/stream`);
    const text = () =>
      socket.messages
        .map((message) => TerminalServerMessageSchema.parse(message))
        .map((message) => (message.type === "output" ? message.data : ""))
        .join("");
    socket.send({ type: "input", data: "echo probe-${THEONE_TOKEN:-absent}-${THEONE_VNC_PASSWORD:-absent}-end\r" });
    await socket.waitFor(() => /probe-\S+-end/.test(text().replace(/echo probe[^\n]*/g, "")), 8_000);
    expect(text()).toContain("probe-absent-absent-end");
    socket.close();
    await t.json("DELETE", `/v1/terminals/${info.id}`);
  });

  test("agent runs", async () => {
    const { body } = await t.json("POST", "/v1/agent/runs", { prompt: "print the env" });
    const { id } = AgentRunDetailSchema.omit({ events: true }).parse(body);
    const run = await waitFor(async () => {
      const detail = AgentRunDetailSchema.parse((await t.json("GET", `/v1/agent/runs/${id}`)).body);
      return detail.endedAt ? detail : null;
    });
    expect(run.result).toBe(clean);
  });
});

describe("env-configured token", () => {
  test("is stored in the token file (0600) so in-sandbox CLI calls work without THEONE_TOKEN", async () => {
    const workspace = makeTempDir("token-mirror");
    const t = await startTestController({ workspace });
    try {
      const file = join(workspace, ".agent", "controller", "token");
      expect(statSync(file).mode & 0o777).toBe(0o600);
      expect(readTokenFile(file)).toBe(TEST_TOKEN);
      const childConfig = loadConfig({ THEONE_WORKSPACE: workspace });
      expect(resolveToken(childConfig, { create: false })).toEqual({ token: TEST_TOKEN, source: "file" });
    } finally {
      await t.stop();
    }
  });

  test("mirrorTokenToFile replaces a stale or invalid file and leaves a matching one alone", () => {
    const workspace = makeTempDir("token-mirror");
    const config = loadConfig({ THEONE_WORKSPACE: workspace, THEONE_TOKEN: "env-token-value" });
    expect(mirrorTokenToFile(config, "env-token-value")).toBe(true);
    expect(mirrorTokenToFile(config, "env-token-value")).toBe(false);
    writeFileSync(config.tokenFile, "not a valid token\n");
    expect(mirrorTokenToFile(config, "env-token-value")).toBe(true);
    expect(readTokenFile(config.tokenFile)).toBe("env-token-value");
    expect(statSync(config.tokenFile).mode & 0o777).toBe(0o600);
    rmSync(config.tokenFile);
  });
});

afterAll(() => removeTempDirs());
