import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { HealthSchema, parsePairingLink, ProjectListSchema, ProjectSchema, SandboxStatusSchema } from "@tesseract/protocol";
import { runCli, type Output } from "../src/cli/commands";
import { ensureDirectories } from "../src/config";
import { hostWorkspaceDir, linkRepository, loadHostWorkspaceConfig } from "../src/host/workspace";
import { makeTempDir, removeTempDirs, startTestController, writeFiles, type TestController } from "./helpers";

function capture(): Output & { stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (text) => stdout.push(text), err: (text) => stderr.push(text) };
}

let t: TestController;
let repo: string;

beforeAll(async () => {
  const root = makeTempDir("host-workspace");
  repo = join(root, "My Repo");
  writeFiles(repo, { "package.json": JSON.stringify({ name: "my-repo", scripts: { dev: "vite" } }) });
  const workspace = join(root, "workspace");
  t = await startTestController({ workspace, env: { TESSERACT_RUNTIME: "host" } });
  linkRepository(t.config, repo);
});

afterAll(async () => {
  await t.stop();
  removeTempDirs();
});

describe("host workspace config", () => {
  test("uses the host runtime, its own workspace and drops the sandbox token", () => {
    const home = makeTempDir("home");
    const config = loadHostWorkspaceConfig({ HOME: home, TESSERACT_TOKEN: "sandbox-token" }, { bind: "127.0.0.1" });
    expect(config.runtime).toBe("host");
    expect(config.workspace).toBe(join(home, ".local", "share", "tesseract", "host-workspace"));
    expect(config.host).toBe("127.0.0.1");
    expect(config.tokenFromEnv).toBeNull();
    expect(hostWorkspaceDir({ HOME: home, XDG_DATA_HOME: "/data" })).toBe("/data/tesseract/host-workspace");
  });

  test("refuses to listen on every interface", () => {
    expect(() => loadHostWorkspaceConfig({ HOME: makeTempDir("home") }, { bind: "0.0.0.0" })).toThrow(/every interface/);
  });
});

describe("linkRepository", () => {
  test("links a repository once, and suffixes another one with the same name", () => {
    const home = makeTempDir("home");
    const config = loadHostWorkspaceConfig({ HOME: home }, { bind: "127.0.0.1" });
    ensureDirectories(config);
    const first = join(home, "a", "app");
    const second = join(home, "b", "app");
    writeFiles(first, { "README.md": "a" });
    writeFiles(second, { "README.md": "b" });
    expect(linkRepository(config, first)).toEqual({ id: "app", path: realpathSync(first), created: true });
    expect(linkRepository(config, first)).toEqual({ id: "app", path: realpathSync(first), created: false });
    expect(linkRepository(config, second)).toMatchObject({ id: "app-2", created: true });
    expect(lstatSync(join(config.projectsDir, "app")).isSymbolicLink()).toBe(true);
    expect(() => linkRepository(config, join(home, "missing"))).toThrow(/does not exist/);
    expect(() => linkRepository(config, config.projectsDir)).toThrow(/inside the host workspace/);
  });
});

describe("host runtime controller", () => {
  test("reports the host runtime", async () => {
    expect(HealthSchema.parse((await t.json("GET", "/v1/health")).body).runtime).toBe("host");
    expect(SandboxStatusSchema.parse((await t.json("GET", "/v1/status")).body).runtime).toBe("host");
  });

  test("lists linked repositories at their host path", async () => {
    const list = ProjectListSchema.parse((await t.json("GET", "/v1/projects")).body);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: "my-repo", name: "my-repo", path: realpathSync(repo), runtime: "host", scripts: ["dev"] });
  });

  test("refuses to create or sync projects", async () => {
    expect((await t.json("POST", "/v1/projects", { name: "fresh" })).status).toBe(400);
    const sync = await t.request("POST", "/v1/projects/my-repo/sync", new Uint8Array(), { "Content-Type": "application/x-tar" });
    expect(sync.status).toBe(400);
  });

  test("deleting a host project removes the link and keeps the repository", async () => {
    const response = await t.json("DELETE", "/v1/projects/my-repo");
    expect(response.status).toBe(200);
    expect(existsSync(join(t.config.projectsDir, "my-repo"))).toBe(false);
    expect(readFileSync(join(repo, "package.json"), "utf8")).toContain("my-repo");
    linkRepository(t.config, repo);
    expect(ProjectSchema.parse((await t.json("GET", "/v1/projects/my-repo")).body).runtime).toBe("host");
  });
});

describe("tesseract-controller host workspace", () => {
  test("add and pair", async () => {
    const home = makeTempDir("home");
    const target = join(home, "repo");
    writeFiles(target, { "README.md": "x" });
    const env = { HOME: home, TESSERACT_HOST_WORKSPACE_BIND: "127.0.0.1" };
    const added = capture();
    expect(await runCli(["host", "workspace", "add", "--json"], { env, output: added, cwd: target })).toBe(0);
    expect(JSON.parse(added.stdout[0] ?? "")).toEqual({ id: "repo", path: realpathSync(target), created: true });

    const paired = capture();
    expect(await runCli(["host", "workspace", "pair", "--json"], { env, output: paired })).toBe(0);
    const pairing = JSON.parse(paired.stdout[0] ?? "") as { link: string; localUrl: string; name: string };
    expect(pairing.localUrl).toBe("http://127.0.0.1:7702");
    expect(parsePairingLink(pairing.link)).toMatchObject({ ok: true, value: { url: "http://127.0.0.1:7702", name: pairing.name } });

    const unknown = capture();
    expect(await runCli(["host", "workspace", "nope"], { env, output: unknown })).toBe(2);
  });
});
