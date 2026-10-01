import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ServerEventSchema, SyncChangesSchema, SyncRequestListSchema, SyncRequestSchema, type SyncChanges, type SyncRequest } from "@theone/protocol";
import { STALE_CLAIM_ERROR } from "../src/services/sync-back";
import { makeTempDir, removeTempDirs, startTestController, waitFor, writeFiles, type TestController, type WsClient } from "./helpers";

let t: TestController;
let events: WsClient;
let projects: string;

const HOST_ONLINE_MS = 1_000;
const sha256 = (value: string) => new Bun.CryptoHasher("sha256").update(value).digest("hex");

function git(cwd: string, ...args: string[]): void {
  const result = Bun.spawnSync(
    ["git", "-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "init.defaultBranch=main", "-c", "commit.gpgsign=false", ...args],
    { cwd, stdout: "pipe", stderr: "pipe" },
  );
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString()}`);
}

async function push(id: string, source: string): Promise<void> {
  const archive = Bun.spawnSync(["tar", "-c", "-z", "-f", "-", "-C", source, "."], { stdout: "pipe" }).stdout;
  const response = await fetch(`${t.baseUrl}/v1/projects/${id}/sync`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t.controller.services.token}`, "Content-Type": "application/gzip" },
    body: archive,
  });
  expect(response.status).toBeLessThan(300);
}

async function changes(id: string): Promise<SyncChanges> {
  const { status, body } = await t.json("GET", `/v1/projects/${id}/sync/changes`);
  expect(status).toBe(200);
  return SyncChangesSchema.parse(body);
}

const summary = (value: SyncChanges) => value.changes.map((change) => `${change.kind} ${change.path}`);

async function syncRequest(method: string, path: string, body?: unknown): Promise<{ status: number; request: SyncRequest | null }> {
  const { status, body: json } = await t.json(method, path, body);
  return { status, request: status < 300 ? SyncRequestSchema.parse(json) : null };
}

beforeAll(async () => {
  const workspace = makeTempDir("sync-back");
  projects = join(workspace, "projects");
  t = await startTestController({ workspace, controller: { syncBack: { hostOnlineMs: HOST_ONLINE_MS } } });
  events = await t.socket("/v1/events");

  const source = makeTempDir("sync-back-source");
  writeFiles(source, {
    ".gitignore": "dist/\n",
    "README.md": "# app\n",
    "old.txt": "old\n",
    "src/a.ts": "export const a = 1;\n",
    "dist/out.js": "built\n",
  });
  git(source, "init", "-q");
  git(source, "add", ".");
  git(source, "commit", "-q", "-m", "initial");
  writeFiles(source, { "untracked.txt": "untracked\n" });
  await push("app", source);

  const plain = makeTempDir("sync-back-plain");
  writeFiles(plain, { "index.js": "1\n", "node_modules/dep/index.js": "dep\n", "lib/util.js": "util\n" });
  await push("plain", plain);
});

afterAll(async () => {
  events.close();
  await t.stop();
  removeTempDirs();
});

describe("baseline and changes", () => {
  test("a push records the baseline of a git checkout and publishes sync.changed", async () => {
    const baseline = JSON.parse(readFileSync(join(t.config.dataDir, "sync", "app.json"), "utf8")) as { pushedAt: string; files: Record<string, string> };
    expect(Object.keys(baseline.files).sort()).toEqual([".gitignore", "README.md", "old.txt", "src/a.ts", "untracked.txt"]);
    expect(baseline.files["src/a.ts"]).toBe(sha256("export const a = 1;\n"));
    const clean = await changes("app");
    expect(clean).toMatchObject({ projectId: "app", baselineAt: baseline.pushedAt, changes: [], totalBytes: 0, host: null });
    await events.waitFor((message) => ServerEventSchema.parse(message).type === "sync.changed");
  });

  test("a project without git is walked, skipping .git and node_modules", async () => {
    const baseline = JSON.parse(readFileSync(join(t.config.dataDir, "sync", "plain.json"), "utf8")) as { files: Record<string, string> };
    expect(Object.keys(baseline.files).sort()).toEqual(["index.js", "lib/util.js"]);
    writeFiles(join(projects, "plain"), { "node_modules/dep/new.js": "x\n", "lib/util.js": "util 2\n" });
    expect(summary(await changes("plain"))).toEqual(["modified lib/util.js"]);
  });

  test("reports added, modified and deleted files; ignored files are left out", async () => {
    const root = join(projects, "app");
    writeFiles(root, { "src/a.ts": "export const a = 2;\n", "new.txt": "fresh\n", "dist/more.js": "ignored\n" });
    rmSync(join(root, "old.txt"));
    symlinkSync("src/a.ts", join(root, "link"));
    const result = await changes("app");
    expect(summary(result)).toEqual(["added link", "added new.txt", "deleted old.txt", "modified src/a.ts"]);
    expect(result.changes.find((change) => change.path === "link")).toMatchObject({ sha256: sha256("src/a.ts"), size: 8 });
    expect(result.changes.find((change) => change.path === "old.txt")).toMatchObject({ sha256: null, size: null });
    expect(result.totalBytes).toBe(8 + 6 + 20);
  });

  test("unknown and never-pushed projects", async () => {
    expect((await t.json("GET", "/v1/projects/missing/sync/changes")).status).toBe(404);
    writeFiles(projects, { "local/file.txt": "x\n" });
    expect(await changes("local")).toMatchObject({ baselineAt: null, changes: [] });
  });
});

describe("export and ack", () => {
  test("exports the requested changes as a gzip tar", async () => {
    const response = await t.request("POST", "/v1/projects/app/sync/export", { paths: ["new.txt", "src/a.ts", "link"] });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/gzip");
    const out = makeTempDir("sync-back-export");
    const archive = join(out, "export.tar.gz");
    writeFileSync(archive, new Uint8Array(await response.arrayBuffer()));
    const listing = Bun.spawnSync(["tar", "-t", "-z", "-f", archive], { stdout: "pipe" }).stdout.toString().trim().split("\n").sort();
    expect(listing).toEqual(["link", "new.txt", "src/a.ts"]);
    const extracted = join(out, "files");
    Bun.spawnSync(["mkdir", "-p", extracted]);
    expect(Bun.spawnSync(["tar", "-x", "-z", "-f", archive, "-C", extracted, "--no-same-owner"]).exitCode).toBe(0);
    expect(readFileSync(join(extracted, "src/a.ts"), "utf8")).toBe("export const a = 2;\n");
    expect(readFileSync(join(extracted, "new.txt"), "utf8")).toBe("fresh\n");
    expect(readlinkSync(join(extracted, "link"))).toBe("src/a.ts");
  });

  test("refuses paths that are not current added or modified changes", async () => {
    for (const path of ["../outside.txt", "/etc/passwd", "old.txt", "README.md", ".git/config", "dist/more.js"]) {
      const { status } = await t.json("POST", "/v1/projects/app/sync/export", { paths: [path] });
      expect(status, path).toBe(400);
    }
    expect((await t.json("POST", "/v1/projects/app/sync/export", { paths: [] })).status).toBe(400);
    expect((await t.json("POST", "/v1/projects/local/sync/export", { paths: ["file.txt"] })).status).toBe(400);
  });

  test("ack moves the baseline so acked changes are not offered again", async () => {
    const { status, body } = await t.json("POST", "/v1/projects/app/sync/ack", {
      changes: [
        { path: "new.txt", sha256: sha256("fresh\n") },
        { path: "old.txt", sha256: null },
      ],
    });
    expect(status).toBe(200);
    expect(summary(SyncChangesSchema.parse(body))).toEqual(["added link", "modified src/a.ts"]);
    expect(summary(await changes("app"))).toEqual(["added link", "modified src/a.ts"]);
    expect((await t.json("POST", "/v1/projects/app/sync/ack", { changes: [{ path: "../x", sha256: null }] })).status).toBe(400);
    expect((await t.json("POST", "/v1/projects/local/sync/ack", { changes: [{ path: "file.txt", sha256: null }] })).status).toBe(400);
  });
});

describe("executable bit", () => {
  test("a mode-only change is offered, and ack records the mode the host now has", async () => {
    const source = makeTempDir("sync-back-modes");
    writeFiles(source, { "run.sh": "echo hi\n", "tool.sh": "echo tool\n", "keep.txt": "keep\n" });
    chmodSync(join(source, "tool.sh"), 0o755);
    await push("modes", source);
    expect(summary(await changes("modes"))).toEqual([]);

    chmodSync(join(projects, "modes", "run.sh"), 0o755);
    chmodSync(join(projects, "modes", "tool.sh"), 0o644);
    const found = await changes("modes");
    expect(summary(found)).toEqual(["modified run.sh", "modified tool.sh"]);
    expect(found.changes[0]!.sha256).toBe(sha256("echo hi\n"));

    // Explicit flag (what the desktop sends) and implicit (the sandbox file's current mode).
    const acked = await t.json("POST", "/v1/projects/modes/sync/ack", {
      changes: [
        { path: "run.sh", sha256: sha256("echo hi\n"), executable: true },
        { path: "tool.sh", sha256: sha256("echo tool\n") },
      ],
    });
    expect(acked.status).toBe(200);
    expect(summary(SyncChangesSchema.parse(acked.body))).toEqual([]);

    // Un-ack (what a desktop revert sends): the mode change is offered again.
    await t.json("POST", "/v1/projects/modes/sync/ack", { changes: [{ path: "run.sh", sha256: sha256("echo hi\n"), executable: false }] });
    expect(summary(await changes("modes"))).toEqual(["modified run.sh"]);
  });

  test("baselines written before modes were tracked only compare content", async () => {
    const file = join(t.config.dataDir, "sync", "modes.json");
    const baseline = JSON.parse(readFileSync(file, "utf8")) as { executable?: string[] };
    delete baseline.executable;
    writeFileSync(file, JSON.stringify(baseline));
    expect(summary(await changes("modes"))).toEqual([]);
  });
});

describe("sync requests", () => {
  test("lifecycle with 409s on invalid transitions", async () => {
    const created = await syncRequest("POST", "/v1/projects/app/sync/requests", { kind: "pull", paths: ["src/a.ts"] });
    expect(created.status).toBe(201);
    expect(created.request).toMatchObject({ kind: "pull", status: "pending", paths: ["src/a.ts"], force: false, source: "mobile", claimedBy: null });
    const id = created.request!.id;
    await events.waitFor((message) => {
      const event = ServerEventSchema.parse(message);
      return event.type === "sync.updated" && event.request.id === id;
    });

    expect((await t.json("POST", "/v1/projects/app/sync/requests", { kind: "revert" })).status).toBe(409);
    const pending = SyncRequestListSchema.parse((await t.json("GET", "/v1/sync/requests?status=pending")).body);
    expect(pending.map((request) => request.id)).toContain(id);
    expect((await t.json("GET", "/v1/sync/requests?status=bogus")).status).toBe(400);

    expect((await syncRequest("POST", `/v1/sync/requests/${id}/cancel`)).request?.status).toBe("cancelled");
    expect((await t.json("POST", `/v1/sync/requests/${id}/cancel`)).status).toBe(409);
    expect((await t.json("POST", `/v1/sync/requests/${id}/claim`, { host: "laptop" })).status).toBe(409);

    const second = (await syncRequest("POST", "/v1/projects/app/sync/requests", { kind: "revert", force: true, source: "cli" })).request!;
    expect(second).toMatchObject({ kind: "revert", force: true, source: "cli", paths: null });
    expect((await t.json("POST", `/v1/sync/requests/${second.id}/complete`, { status: "applied" })).status).toBe(409);
    const claimed = await syncRequest("POST", `/v1/sync/requests/${second.id}/claim`, { host: "laptop" });
    expect(claimed.request).toMatchObject({ status: "claimed", claimedBy: "laptop" });
    expect((await t.json("POST", `/v1/sync/requests/${second.id}/claim`, { host: "other" })).status).toBe(409);
    expect((await t.json("POST", `/v1/sync/requests/${second.id}/cancel`)).status).toBe(409);
    const result = { added: 1, modified: 0, deleted: 0, conflicts: [], snapshotId: "snap1", hostPath: "/home/me/app" };
    const done = await syncRequest("POST", `/v1/sync/requests/${second.id}/complete`, { status: "applied", result });
    expect(done.request).toMatchObject({ status: "applied", result, error: null });
    expect((await t.json("POST", `/v1/sync/requests/${second.id}/complete`, { status: "failed" })).status).toBe(409);

    const listed = SyncRequestListSchema.parse((await t.json("GET", "/v1/projects/app/sync/requests")).body);
    expect(listed.map((request) => request.id)).toEqual([second.id, id]);
  });

  test("rejects pulls before a push, unknown projects and unknown ids", async () => {
    expect((await t.json("POST", "/v1/projects/local/sync/requests", { kind: "pull" })).status).toBe(400);
    expect((await t.json("POST", "/v1/projects/missing/sync/requests", { kind: "pull" })).status).toBe(404);
    expect((await t.json("POST", "/v1/sync/requests/sync_nothere/claim", { host: "laptop" })).status).toBe(404);
    expect((await t.json("POST", "/v1/sync/requests/nope/cancel")).status).toBe(404);
    expect((await t.json("POST", "/v1/projects/app/sync/requests", { kind: "pull", paths: ["../x"] })).status).toBe(400);
  });

  test("a failed request keeps its error", async () => {
    const request = (await syncRequest("POST", "/v1/projects/plain/sync/requests", { kind: "pull" })).request!;
    await syncRequest("POST", `/v1/sync/requests/${request.id}/claim`, { host: "laptop" });
    const failed = await syncRequest("POST", `/v1/sync/requests/${request.id}/complete`, { status: "failed", error: "Conflicts" });
    expect(failed.request).toMatchObject({ status: "failed", error: "Conflicts" });
  });

  test("a stale claim is failed by the sweeper", async () => {
    const request = (await syncRequest("POST", "/v1/projects/plain/sync/requests", { kind: "pull" })).request!;
    await syncRequest("POST", `/v1/sync/requests/${request.id}/claim`, { host: "laptop" });
    expect(t.controller.services.syncBack.sweep()).toEqual([]);
    const swept = t.controller.services.syncBack.sweep(Date.now() + 11 * 60_000);
    expect(swept.map((entry) => entry.id)).toEqual([request.id]);
    const after = SyncRequestListSchema.parse((await t.json("GET", "/v1/projects/plain/sync/requests")).body)[0];
    expect(after).toMatchObject({ id: request.id, status: "failed", error: STALE_CLAIM_ERROR });
    expect((await t.json("POST", `/v1/sync/requests/${request.id}/complete`, { status: "applied" })).status).toBe(409);
  });
});

describe("heartbeat", () => {
  test("remembers the host per project and reports it online for a while", async () => {
    const response = await t.request("POST", "/v1/sync/heartbeat", { host: "laptop", projects: ["app"] });
    expect(response.status).toBe(204);
    expect((await changes("app")).host).toMatchObject({ name: "laptop", online: true, linked: true });
    expect((await changes("plain")).host).toMatchObject({ name: "laptop", online: true, linked: false });
    expect((await t.json("POST", "/v1/sync/heartbeat", { host: "", projects: [] })).status).toBe(400);
    await waitFor(async () => (await changes("app")).host?.online === false, HOST_ONLINE_MS * 3);
  });
});

test("baseline file is not written for a failed push", async () => {
  const response = await t.request("POST", "/v1/projects/broken/sync", "not a tar", { "Content-Type": "application/gzip" });
  expect(response.status).toBe(400);
  expect(existsSync(join(t.config.dataDir, "sync", "broken.json"))).toBe(false);
});
