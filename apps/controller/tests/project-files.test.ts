import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { ProjectDirectorySchema, ProjectStorageSchema, restPaths, type ProjectStorage } from "@tesseract/protocol";
import { removeTempDirs, startTestController, writeFiles, type TestController } from "./helpers";

let t: TestController;

const git = (cwd: string, ...args: string[]) => {
  const result = Bun.spawnSync(["git", "-C", cwd, ...args]);
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
};

beforeAll(async () => {
  t = await startTestController();
  writeFiles(t.workspace, {
    "projects/app/package.json": "{}",
    "projects/app/.gitignore": "node_modules\ndist\n.expo\n",
    "projects/app/src/index.ts": "export {};",
    "projects/app/node_modules/pkg/index.js": "x".repeat(8192),
    "projects/app/dist/bundle.js": "y".repeat(8192),
    "projects/app/.expo/state.json": "{}",
    "projects/app/build/script.sh": "tracked build helpers",
    "projects/loose/node_modules/pkg/index.js": "z",
    "projects/loose/dist/index.js": "not provably generated",
    "outside/secret.txt": "secret",
  });
  const app = join(t.workspace, "projects/app");
  git(app, "init", "-q");
  symlinkSync(join(t.workspace, "outside/secret.txt"), join(app, "src/leak.txt"));
});

afterAll(async () => {
  await t.stop();
  removeTempDirs();
});

describe("GET /v1/projects/:id/files", () => {
  test("lists a directory with folders first", async () => {
    const { status, body } = await t.json("GET", restPaths.projectFiles("app"));
    expect(status).toBe(200);
    const directory = ProjectDirectorySchema.parse(body);
    expect(directory.path).toBe("");
    const names = directory.entries.map((entry) => entry.name);
    expect(names.indexOf("src")).toBeLessThan(names.indexOf("package.json"));
    expect(directory.entries.find((entry) => entry.name === "package.json")).toMatchObject({ kind: "file", sizeBytes: 2, path: "package.json" });
    expect(directory.entries.find((entry) => entry.name === "src")).toMatchObject({ kind: "dir", sizeBytes: null });
  });

  test("lists nested folders and refuses escapes", async () => {
    const { body } = await t.json("GET", restPaths.projectFiles("app", { path: "src" }));
    expect(ProjectDirectorySchema.parse(body).entries.map((entry) => entry.path)).toEqual(["src/index.ts", "src/leak.txt"]);
    expect((await t.json("GET", restPaths.projectFiles("app", { path: "../loose" }))).status).toBe(404);
    expect((await t.json("GET", restPaths.projectFiles("app", { path: "package.json" }))).status).toBe(400);
  });
});

describe("GET /v1/projects/:id/files/download", () => {
  test("streams a file with a one-time ticket", async () => {
    const ticket = await t.ticket();
    const url = `${t.baseUrl}${restPaths.projectFileDownload("app", { path: "src/index.ts", ticket })}`;
    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain('filename="index.ts"');
    expect(await response.text()).toBe("export {};");
    expect((await fetch(url)).status).toBe(401);
  });

  test("refuses symlinks leading out of the project and directories", async () => {
    expect((await t.request("GET", restPaths.projectFileDownload("app", { path: "src/leak.txt" }))).status).toBe(404);
    expect((await t.request("GET", restPaths.projectFileDownload("app", { path: "../../outside/secret.txt" }))).status).toBe(404);
    expect((await t.request("GET", restPaths.projectFileDownload("app", { path: "src" }))).status).toBe(400);
  });
});

describe("project storage", () => {
  const entry = (storage: ProjectStorage, category: string) => storage.entries.find((item) => item.category === category)!;

  test("splits git-ignored regenerable folders from source", async () => {
    const { status, body } = await t.json("GET", restPaths.projectStorage("app"));
    expect(status).toBe(200);
    const storage = ProjectStorageSchema.parse(body);
    expect(entry(storage, "dependencies").paths).toEqual(["node_modules"]);
    expect(entry(storage, "builds").paths).toEqual(["dist"]);
    expect(entry(storage, "caches").paths).toEqual([".expo"]);
    expect(entry(storage, "dependencies").sizeBytes).toBeGreaterThan(0);
    expect(storage.totalBytes).toBeGreaterThanOrEqual(storage.sourceBytes + entry(storage, "dependencies").sizeBytes);
  });

  test("outside git only dependencies and caches count", async () => {
    const storage = ProjectStorageSchema.parse((await t.json("GET", restPaths.projectStorage("loose"))).body);
    expect(entry(storage, "dependencies").paths).toEqual(["node_modules"]);
    expect(entry(storage, "builds").paths).toEqual([]);
  });

  test("clears the chosen categories and keeps source", async () => {
    const app = join(t.workspace, "projects/app");
    const { status, body } = await t.json("POST", restPaths.projectStorageClear("app"), { categories: ["builds"] });
    expect(status).toBe(200);
    expect(entry(ProjectStorageSchema.parse(body), "builds").paths).toEqual([]);
    expect(existsSync(join(app, "dist"))).toBe(false);
    expect(existsSync(join(app, "node_modules"))).toBe(true);

    const all = await t.json("POST", restPaths.projectStorageClear("app"));
    expect(all.status).toBe(200);
    expect(existsSync(join(app, "node_modules"))).toBe(false);
    expect(existsSync(join(app, ".expo"))).toBe(false);
    expect(existsSync(join(app, "build/script.sh"))).toBe(true);
    expect(existsSync(join(app, "src/index.ts"))).toBe(true);
  });
});
