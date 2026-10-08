import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, lstatSync, readdirSync, readFileSync, readlinkSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SyncChangesSchema, SyncDiscardResultSchema, SyncRequestSchema, type SyncChanges, type SyncDiscardResult } from "@tesseract/protocol";
import { makeTempDir, removeTempDirs, startTestController, TEST_TOKEN, writeFiles, type TestController } from "./helpers";

let t: TestController;
let projects: string;

const sha256 = (value: string) => new Bun.CryptoHasher("sha256").update(value).digest("hex");
const sandbox = (id: string, path: string) => join(projects, id, path);
const read = (id: string, path: string) => readFileSync(sandbox(id, path), "utf8");
const isExecutable = (id: string, path: string) => (statSync(sandbox(id, path)).mode & 0o111) !== 0;
const blobDir = (id: string) => join(t.config.dataDir, "sync", "blobs", id);
const blobs = (id: string) => (existsSync(blobDir(id)) ? readdirSync(blobDir(id)).sort() : []);

async function push(id: string, source: string): Promise<void> {
  const archive = Bun.spawnSync(["tar", "-c", "-z", "-f", "-", "-C", source, "."], { stdout: "pipe" }).stdout;
  const response = await fetch(`${t.baseUrl}/v1/projects/${id}/sync`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TEST_TOKEN}`, "Content-Type": "application/gzip" },
    body: archive,
  });
  expect(response.status).toBeLessThan(300);
}

async function changes(id: string): Promise<SyncChanges> {
  const { body } = await t.json("GET", `/v1/projects/${id}/sync/changes`);
  return SyncChangesSchema.parse(body);
}

const summary = (value: SyncChanges) => value.changes.map((change) => `${change.kind} ${change.path}${change.discardable ? "" : " (kept)"}`);

async function discard(id: string, body: unknown = {}): Promise<SyncDiscardResult> {
  const { status, body: json } = await t.json("POST", `/v1/projects/${id}/sync/discard`, body);
  expect(status, JSON.stringify(json)).toBe(200);
  return SyncDiscardResultSchema.parse(json);
}

async function project(id: string, files: Record<string, string>): Promise<string> {
  const source = makeTempDir(`discard-${id}`);
  writeFiles(source, files);
  await push(id, source);
  return source;
}

beforeAll(async () => {
  const workspace = makeTempDir("sync-discard");
  projects = join(workspace, "projects");
  t = await startTestController({ workspace });
});

afterAll(async () => {
  await t.stop();
  removeTempDirs();
});

describe("baseline blobs", () => {
  test("a push stores every baseline file and symlink target; the next push drops unreferenced blobs", async () => {
    const source = await project("blobs", { "a.txt": "a\n", "b.txt": "b\n", "same.txt": "a\n" });
    symlinkSync("a.txt", join(source, "link"));
    await push("blobs", source);
    expect(blobs("blobs")).toEqual([sha256("a\n"), sha256("a.txt") + ".link", sha256("b\n")].sort());
    expect(readFileSync(join(blobDir("blobs"), sha256("b\n")), "utf8")).toBe("b\n");
    expect(statSync(join(blobDir("blobs"), sha256("b\n"))).mode & 0o777).toBe(0o600);
    expect(statSync(blobDir("blobs")).mode & 0o777).toBe(0o700);

    writeFiles(source, { "b.txt": "b2\n" });
    await push("blobs", source);
    expect(blobs("blobs")).toEqual([sha256("a\n"), sha256("a.txt") + ".link", sha256("b2\n")].sort());
  });

  test("ack stores the acked content when the sandbox has it, and keeps old blobs until the next push", async () => {
    writeFiles(projects, { "blobs/b.txt": "b3\n", "blobs/c.txt": "c\n" });
    await t.json("POST", "/v1/projects/blobs/sync/ack", {
      changes: [
        { path: "b.txt", sha256: sha256("b3\n") },
        { path: "c.txt", sha256: sha256("not the sandbox content\n") },
      ],
    });
    expect(blobs("blobs")).toEqual([sha256("a\n"), sha256("a.txt") + ".link", sha256("b2\n"), sha256("b3\n")].sort());

    // A host revert acks the old hash back: its blob is still there, so the change can be discarded.
    await t.json("POST", "/v1/projects/blobs/sync/ack", { changes: [{ path: "b.txt", sha256: sha256("b2\n") }] });
    expect(summary(await changes("blobs"))).toContain("modified b.txt");
    await discard("blobs", { paths: ["b.txt"] });
    expect(read("blobs", "b.txt")).toBe("b2\n");
  });

  test("a get stores the incoming files", async () => {
    const host = await project("got", { "a.txt": "a\n" });
    writeFiles(host, { "a.txt": "from host\n", "new.txt": "new\n" });
    const created = await t.json("POST", "/v1/projects/got/sync/requests", { kind: "get", source: "mobile" });
    expect(created.status).toBe(201);
    const request = SyncRequestSchema.parse(created.body);
    expect(request.source).toBe("mobile");
    expect((await t.json("POST", `/v1/sync/requests/${request.id}/claim`, { host: "laptop" })).status).toBe(200);
    const changesBody = [
      { path: "a.txt", kind: "modified", sha256: sha256("from host\n"), executable: false },
      { path: "new.txt", kind: "added", sha256: sha256("new\n"), executable: false },
    ];
    expect((await t.json("POST", `/v1/sync/requests/${request.id}/plan`, { hostPath: host, changes: changesBody, git: null })).status).toBe(200);
    const archive = Bun.spawnSync(["tar", "-c", "-z", "-f", "-", "-C", host, "a.txt", "new.txt"], { stdout: "pipe" }).stdout;
    const applied = await fetch(`${t.baseUrl}/v1/sync/requests/${request.id}/apply`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TEST_TOKEN}`, "Content-Type": "application/gzip" },
      body: archive,
    });
    expect(applied.status).toBe(200);
    expect(blobs("got")).toEqual([sha256("a\n"), sha256("from host\n"), sha256("new\n")].sort());

    writeFiles(projects, { "got/new.txt": "edited\n" });
    await discard("got");
    expect(read("got", "new.txt")).toBe("new\n");
  });
});

describe("discard", () => {
  beforeAll(async () => {
    const source = await project("app", { "README.md": "# app\n", "src/a.ts": "a\n", "src/b.ts": "b\n", "run.sh": "echo hi\n", "gone.sh": "echo gone\n", "tool.sh": "echo tool\n" });
    symlinkSync("README.md", join(source, "link"));
    chmodSync(join(source, "run.sh"), 0o755);
    chmodSync(join(source, "gone.sh"), 0o755);
    await push("app", source);
  });

  test("every change is discardable; discarding restores content, executable bits and symlinks, removes added files and backs up", async () => {
    writeFiles(projects, { "app/src/a.ts": "a edited\n", "app/new/deep/file.txt": "new\n", "app/tool.sh": "echo changed\n" });
    chmodSync(sandbox("app", "run.sh"), 0o644);
    chmodSync(sandbox("app", "tool.sh"), 0o755);
    rmSync(sandbox("app", "gone.sh"));
    unlinkSync(sandbox("app", "link"));
    writeFileSync(sandbox("app", "link"), "now a file\n");
    expect(summary(await changes("app"))).toEqual([
      "deleted gone.sh",
      "modified link",
      "added new/deep/file.txt",
      "modified run.sh",
      "modified src/a.ts",
      "modified tool.sh",
    ]);

    const result = await discard("app");
    expect(result.discarded.sort()).toEqual(["gone.sh", "link", "new/deep/file.txt", "run.sh", "src/a.ts", "tool.sh"]);
    expect(result.unavailable).toEqual([]);
    expect(result.changes.changes).toEqual([]);
    expect(await changes("app")).toMatchObject({ changes: [] });

    expect(read("app", "src/a.ts")).toBe("a\n");
    expect(read("app", "gone.sh")).toBe("echo gone\n");
    expect(isExecutable("app", "gone.sh")).toBe(true);
    expect(isExecutable("app", "run.sh")).toBe(true);
    expect(read("app", "tool.sh")).toBe("echo tool\n");
    expect(isExecutable("app", "tool.sh")).toBe(false);
    expect(lstatSync(sandbox("app", "link")).isSymbolicLink()).toBe(true);
    expect(readlinkSync(sandbox("app", "link"))).toBe("README.md");
    expect(existsSync(sandbox("app", "new"))).toBe(false);

    expect(result.backupPath).toStartWith(join(t.config.dataDir, "sync", "backups", "app", "discard-"));
    expect(readFileSync(join(result.backupPath!, "src/a.ts"), "utf8")).toBe("a edited\n");
    expect(readFileSync(join(result.backupPath!, "new/deep/file.txt"), "utf8")).toBe("new\n");
    expect(readFileSync(join(result.backupPath!, "link"), "utf8")).toBe("now a file\n");
  });

  test("a subset of paths", async () => {
    writeFiles(projects, { "app/src/a.ts": "a again\n", "app/src/b.ts": "b again\n" });
    const result = await discard("app", { paths: ["src/b.ts"] });
    expect(result.discarded).toEqual(["src/b.ts"]);
    expect(read("app", "src/b.ts")).toBe("b\n");
    expect(read("app", "src/a.ts")).toBe("a again\n");
    expect(summary(result.changes)).toEqual(["modified src/a.ts"]);
  });

  test("refuses paths that are not changes, unknown and never-pushed projects, and runs while a request is active", async () => {
    for (const paths of [["README.md"], ["../outside"], [".git/config"], []]) {
      expect((await t.json("POST", "/v1/projects/app/sync/discard", { paths })).status, String(paths)).toBe(400);
    }
    expect((await t.json("POST", "/v1/projects/missing/sync/discard", {})).status).toBe(404);
    writeFiles(projects, { "local/file.txt": "x\n" });
    expect((await t.json("POST", "/v1/projects/local/sync/discard", {})).status).toBe(400);

    const created = await t.json("POST", "/v1/projects/app/sync/requests", { kind: "pull" });
    expect(created.status).toBe(201);
    const conflict = await t.json("POST", "/v1/projects/app/sync/discard", {});
    expect(conflict.status).toBe(409);
    expect(conflict.body).toMatchObject({ error: { code: "conflict" } });
    expect(read("app", "src/a.ts")).toBe("a again\n");
    await t.json("POST", `/v1/sync/requests/${SyncRequestSchema.parse(created.body).id}/cancel`);
    expect((await discard("app")).discarded).toEqual(["src/a.ts"]);
  });

  test("changes whose baseline content is not stored are left alone", async () => {
    rmSync(blobDir("app"), { recursive: true, force: true });
    writeFiles(projects, { "app/src/a.ts": "kept\n", "app/extra.txt": "extra\n" });
    chmodSync(sandbox("app", "run.sh"), 0o644);
    expect(summary(await changes("app"))).toEqual(["added extra.txt", "modified run.sh", "modified src/a.ts (kept)"]);
    const result = await discard("app");
    expect(result.discarded.sort()).toEqual(["extra.txt", "run.sh"]);
    expect(result.unavailable).toEqual(["src/a.ts"]);
    expect(read("app", "src/a.ts")).toBe("kept\n");
    expect(isExecutable("app", "run.sh")).toBe(true);
    expect(existsSync(sandbox("app", "extra.txt"))).toBe(false);
    expect(summary(result.changes)).toEqual(["modified src/a.ts (kept)"]);
  });
});
