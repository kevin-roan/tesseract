import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { CreateProjectResponseSchema, GitDetailsSchema, ProjectListSchema, ProjectSchema, type Project } from "@theone/protocol";
import { parseStatus } from "../src/services/git";
import { detectProject } from "../src/services/project-detect";
import { makeTempDir, removeTempDirs, startTestController, waitFor, writeFiles, type TestController } from "./helpers";

let t: TestController;
let projects: string;

const git = (cwd: string, ...args: string[]) => {
  const result = Bun.spawnSync(["git", "-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "init.defaultBranch=main", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString()}`);
  return result.stdout.toString();
};

beforeAll(async () => {
  const workspace = makeTempDir("projects");
  projects = join(workspace, "projects");
  writeFiles(projects, {
    "desktop-app/package.json": JSON.stringify({
      name: "desktop-app",
      version: "1.2.3",
      main: "main.js",
      scripts: { start: "electron .", build: "tsc -p ." },
      devDependencies: { electron: "^38.0.0", "electron-builder": "^26.0.0" },
    }),
    "desktop-app/package-lock.json": "{}",
    "mobile-app/package.json": JSON.stringify({
      name: "mobile-app",
      scripts: { start: "expo start", build: "expo export -p web" },
      dependencies: { expo: "~56.0.0", "react-native": "0.85.0" },
    }),
    "mobile-app/app.json": JSON.stringify({ expo: { name: "mobile" } }),
    "mobile-app/bun.lock": "{}",
    "plain-node/package.json": JSON.stringify({ name: "plain", scripts: { start: "node index.js" } }),
    "plain-node/yarn.lock": "",
    "forge-app/package.json": JSON.stringify({ devDependencies: { "@electron-forge/cli": "^7.0.0", electron: "^38.0.0" } }),
    "forge-app/pnpm-lock.yaml": "",
    "py-tool/pyproject.toml": "[project]\nname = 'py-tool'\n",
    "empty/.keep": "",
  });
  mkdirSync(join(projects, "Not_Valid"), { recursive: true });
  symlinkSync("/tmp", join(projects, "escape"));
  git(join(projects, "desktop-app"), "init", "-q");
  git(join(projects, "desktop-app"), "add", ".");
  git(join(projects, "desktop-app"), "commit", "-q", "-m", "Initial commit");
  writeFiles(projects, { "desktop-app/notes.txt": "dirty\n" });
  t = await startTestController({ workspace });
});

afterAll(async () => {
  await t.stop();
  removeTempDirs();
});

describe("detection", () => {
  test("electron-builder app", () => {
    const facts = detectProject(join(projects, "desktop-app"));
    expect(facts.framework).toBe("electron");
    expect(facts.packageManager).toBe("npm");
    expect(facts.electronTool).toBe("electron-builder");
    expect(facts.buildTargets).toEqual(["electron-linux", "electron-windows", "script"]);
  });

  test("expo app", () => {
    const facts = detectProject(join(projects, "mobile-app"));
    expect(facts.framework).toBe("expo");
    expect(facts.packageManager).toBe("bun");
    expect(facts.buildTargets).toEqual(["android-apk", "web", "script"]);
  });

  test("plain node, forge, python and empty projects", () => {
    expect(detectProject(join(projects, "plain-node"))).toMatchObject({ framework: "node", packageManager: "yarn", buildTargets: [] });
    expect(detectProject(join(projects, "forge-app"))).toMatchObject({
      framework: "electron",
      packageManager: "pnpm",
      electronTool: "electron-forge",
      buildTargets: ["electron-linux", "electron-windows"],
    });
    expect(detectProject(join(projects, "py-tool"))).toMatchObject({ framework: "python", packageManager: null });
    expect(detectProject(join(projects, "empty"))).toMatchObject({ framework: "unknown", scripts: [], buildTargets: [] });
  });

  test("parses porcelain v2 status", () => {
    const output = [
      "# branch.oid abc",
      "# branch.head feature/x",
      "# branch.upstream origin/feature/x",
      "# branch.ab +2 -1",
      "1 .M N... 100644 100644 100644 a b src/file name.ts",
      "2 R. N... 100644 100644 100644 a b R100 new.ts",
      "old.ts",
      "? untracked.txt",
      "",
    ].join("\0");
    expect(parseStatus(output)).toEqual({
      branch: "feature/x",
      ahead: 2,
      behind: 1,
      files: [
        { path: "src/file name.ts", index: " ", worktree: "M" },
        { path: "new.ts", index: "R", worktree: " " },
        { path: "untracked.txt", index: "?", worktree: "?" },
      ],
    });
  });
});

describe("REST", () => {
  test("lists valid project directories only", async () => {
    const { status, body } = await t.json("GET", "/v1/projects");
    expect(status).toBe(200);
    const list = ProjectListSchema.parse(body);
    expect(list.map((project) => project.id)).toEqual(["desktop-app", "empty", "forge-app", "mobile-app", "plain-node", "py-tool"]);
    const desktop = list.find((project) => project.id === "desktop-app");
    expect(desktop?.name).toBe("desktop-app");
    expect(desktop?.git).toMatchObject({ branch: "main", dirty: true, ahead: 0, behind: 0 });
    expect(desktop?.git?.lastCommit?.subject).toBe("Initial commit");
    expect(list.find((project) => project.id === "plain-node")?.git).toBeNull();
  });

  test("gets one project and refuses symlinks out of the workspace", async () => {
    const one = await t.json("GET", "/v1/projects/MOBILE-APP");
    expect(one.status).toBe(200);
    expect(ProjectSchema.parse(one.body).framework).toBe("expo");
    expect((await t.json("GET", "/v1/projects/missing")).status).toBe(404);
    expect((await t.json("GET", "/v1/projects/escape")).status).toBe(403);
  });

  test("git details", async () => {
    const { status, body } = await t.json("GET", "/v1/projects/desktop-app/git");
    expect(status).toBe(200);
    const details = GitDetailsSchema.parse(body);
    expect(details.branch).toBe("main");
    expect(details.files).toContainEqual({ path: "notes.txt", index: "?", worktree: "?" });
    expect(details.log[0]?.subject).toBe("Initial commit");
    expect(details.log[0]?.date).toMatch(/Z$/);
    expect((await t.json("GET", "/v1/projects/plain-node/git")).status).toBe(404);
  });

  test("renames a project's display name and restores the detected one", async () => {
    const renamed = await t.json("PUT", "/v1/projects/plain-node/name", { name: "  Plain Tool  " });
    expect(renamed.status).toBe(200);
    expect(ProjectSchema.parse(renamed.body)).toMatchObject({ id: "plain-node", name: "Plain Tool" });
    expect(ProjectSchema.parse((await t.json("GET", "/v1/projects/plain-node")).body).name).toBe("Plain Tool");
    expect((await t.json("PUT", "/v1/projects/plain-node/name", { name: " " })).status).toBe(400);
    expect((await t.json("PUT", "/v1/projects/missing/name", { name: "x" })).status).toBe(404);
    const restored = await t.json("PUT", "/v1/projects/plain-node/name", { name: null });
    expect(ProjectSchema.parse(restored.body).name).toBe("plain");
  });

  test("creates an empty git project and rejects duplicates", async () => {
    const created = await t.json("POST", "/v1/projects", { name: "My New App" });
    expect(created.status).toBe(201);
    const response = CreateProjectResponseSchema.parse(created.body);
    expect(response.project.id).toBe("my-new-app");
    expect(response.processId).toBeUndefined();
    expect(response.project.git).not.toBeNull();
    expect((await t.json("POST", "/v1/projects", { name: "my new app" })).status).toBe(409);
  });

  test("clones a repository as a tracked process", async () => {
    const source = makeTempDir("origin");
    writeFiles(source, { "README.md": "# hello\n", "package.json": JSON.stringify({ name: "cloned", scripts: { build: "echo ok" } }) });
    git(source, "init", "-q");
    git(source, "add", ".");
    git(source, "commit", "-q", "-m", "Seed");
    const created = await t.json("POST", "/v1/projects", { name: "cloned", gitUrl: `file://${source}` });
    expect(created.status).toBe(201);
    const { processId } = CreateProjectResponseSchema.parse(created.body);
    expect(processId).toMatch(/^prc_/);
    const finished = await waitFor(async () => {
      const { body } = await t.json<{ state: string }>("GET", `/v1/processes/${processId}`);
      return body.state === "exited" ? body : null;
    }, 10_000);
    expect(finished.state).toBe("exited");
    const project = (await t.json<Project>("GET", "/v1/projects/cloned")).body;
    expect(project.framework).toBe("node");
    expect(project.scripts).toEqual(["build"]);
    expect(project.git?.lastCommit?.subject).toBe("Seed");
  });

  test("syncs a tar archive into a new or existing project", async () => {
    const source = makeTempDir("sync");
    writeFiles(source, { "package.json": JSON.stringify({ name: "synced", scripts: { dev: "vite" } }), "src/main.ts": "export {};\n" });
    const archive = (gzip: boolean) =>
      Bun.spawnSync(["tar", "-c", ...(gzip ? ["-z"] : []), "-f", "-", "-C", source, "."], { stdout: "pipe" }).stdout;

    const sync = (id: string, body: Uint8Array | string, contentType: string) =>
      fetch(`${t.baseUrl}/v1/projects/${id}/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t.controller.services.token}`, "Content-Type": contentType },
        body,
      });

    const created = await sync("synced", archive(true), "application/gzip");
    expect(created.status).toBe(201);
    expect(ProjectSchema.parse(await created.json())).toMatchObject({ id: "synced", scripts: ["dev"] });
    expect(readFileSync(join(projects, "synced/src/main.ts"), "utf8")).toBe("export {};\n");

    writeFiles(projects, { "synced/keep.txt": "sandbox only\n" });
    writeFiles(source, { "src/main.ts": "export const x = 1;\n" });
    const updated = await sync("synced", archive(false), "application/x-tar");
    expect(updated.status).toBe(200);
    expect(readFileSync(join(projects, "synced/src/main.ts"), "utf8")).toBe("export const x = 1;\n");
    expect(existsSync(join(projects, "synced/keep.txt"))).toBe(true);

    const garbage = await sync("broken", "not a tar", "application/gzip");
    expect(garbage.status).toBe(400);
    expect(existsSync(join(projects, "broken"))).toBe(false);
    const json = await sync("synced", "{}", "application/json");
    expect(json.status).toBe(400);
  });

  test("sync?confidential=1 marks the project: pseudonym name, flag and redacted git authors", async () => {
    const source = makeTempDir("confidential");
    writeFiles(source, { "package.json": JSON.stringify({ name: "acme-billing-portal" }) });
    git(source, "init", "-q");
    git(source, "add", ".");
    git(source, "commit", "-q", "-m", "Seed");
    const archive = Bun.spawnSync(["tar", "-c", "-f", "-", "-C", source, "."], { stdout: "pipe" }).stdout;
    const sync = (id: string, query: string) =>
      fetch(`${t.baseUrl}/v1/projects/${id}/sync${query}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t.controller.services.token}`, "Content-Type": "application/x-tar" },
        body: archive,
      });

    const plain = ProjectSchema.parse(await (await sync("open-fox", "?confidential=true")).json());
    expect(plain).toMatchObject({ id: "open-fox", name: "acme-billing-portal", confidential: false });
    const plainGit = GitDetailsSchema.parse((await t.json("GET", "/v1/projects/open-fox/git")).body);
    expect(plainGit.log[0]?.author).toBe("Test");

    const marked = ProjectSchema.parse(await (await sync("morning-cat", "?confidential=1")).json());
    expect(marked).toMatchObject({ id: "morning-cat", name: "morning-cat", confidential: true });
    const again = ProjectSchema.parse(await (await sync("morning-cat", "")).json());
    expect(again).toMatchObject({ name: "morning-cat", confidential: true });
    const details = GitDetailsSchema.parse((await t.json("GET", "/v1/projects/morning-cat/git")).body);
    expect(details.log.map((commit) => commit.author)).toEqual(["REDACTED"]);
    expect(details.log[0]?.subject).toBe("Seed");
    const listed = ProjectListSchema.parse((await t.json("GET", "/v1/projects")).body);
    expect(listed.find((project) => project.id === "morning-cat")).toMatchObject({ name: "morning-cat", confidential: true });
    expect(listed.find((project) => project.id === "desktop-app")?.confidential).toBe(false);
  });

  test("creates a confidential project", async () => {
    const created = await t.json("POST", "/v1/projects", { name: "quiet-heron", confidential: true });
    expect(created.status).toBe(201);
    expect(CreateProjectResponseSchema.parse(created.body).project).toMatchObject({ id: "quiet-heron", name: "quiet-heron", confidential: true });
    expect(t.controller.services.projects.isConfidential("quiet-heron")).toBe(true);
  });
});
