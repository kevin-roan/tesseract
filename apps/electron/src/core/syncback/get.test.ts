import { chmod, mkdir, readFile, rm, stat, symlink, unlink, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NetworkError } from "@tesseract/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runStatus } from "./cli";
import { EXIT } from "./constants";
import { GET_LIMITS, hostChanges, planGit } from "./get";
import { DigestCache, buildManifest, hashPath, resolvePath } from "./manifest";
import { handleRequest } from "./requests";
import { notificationKind } from "./service";
import { SyncState, newLink, type Link } from "./state";
import { describeResult } from "./summary";
import { SYNC_BACK_TITLES } from "./labels";
import { BASELINE_AT, FakeController, PROJECT, SYNCED_AT, tempDir, write } from "./testing";
import { collectFiles, contained, gitManifest, scanTree } from "./tree";

const POSIX = process.platform !== "win32";

let tmp: string;
let host: string;
let state: SyncState;
let controller: FakeController;

async function push(): Promise<Link> {
  const scanned = await scanTree(host, await collectFiles(host));
  const link = newLink({ projectId: PROJECT, hostPath: host, pushedAt: BASELINE_AT, manifest: scanned.manifest, executable: scanned.executable, gitManifest: scanned.git });
  await state.saveLink(link);
  return link;
}

async function hostEdits(): Promise<void> {
  await write(host, "src/app.py", "print('v2')\n");
  await write(host, "src/new/feature.py", "new\n");
  await unlink(join(host, "src/old.py"));
}

const runGet = (force = false) => handleRequest(controller, state, controller.addRequest("get", force), "laptop");

beforeEach(async () => {
  tmp = await resolvePath(await tempDir("get"));
  host = join(tmp, "host", PROJECT);
  await write(host, "README.md", "hello\n");
  await write(host, "src/app.py", "print('v1')\n");
  await write(host, "src/old.py", "old\n");
  await write(host, "run.sh", "echo run\n");
  await write(host, ".git/HEAD", "ref: refs/heads/main\n");
  await write(host, ".git/refs/heads/main", `${"a".repeat(40)}\n`);
  await write(host, ".git/objects/aa/one", "object one");
  state = new SyncState(join(tmp, "state"));
  await push();
  controller = new FakeController(join(tmp, "sandbox"));
});

afterEach(async () => {
  GET_LIMITS.maxChanges = 5000;
  GET_LIMITS.maxGitPaths = 200_000;
  await rm(tmp, { recursive: true, force: true });
});

describe("get", () => {
  it("sends added, modified and deleted files and records the link", async () => {
    await hostEdits();
    const handled = await runGet();
    expect(handled.ok).toBe(true);
    expect(controller.plans[0]?.hostPath).toBe(host);
    expect(controller.plans[0]?.changes).toEqual([
      { path: "src/app.py", kind: "modified", sha256: await hashPath(join(host, "src/app.py")), executable: false },
      { path: "src/new/feature.py", kind: "added", sha256: await hashPath(join(host, "src/new/feature.py")), executable: false },
      { path: "src/old.py", kind: "deleted", sha256: null, executable: false },
    ]);
    expect(controller.plans[0]?.git).toEqual({ changed: [], deleted: [] });
    expect(new Set(controller.archives[0]?.keys())).toEqual(new Set(["src/app.py", "src/new/feature.py"]));
    expect(controller.contents.get("src/app.py")?.toString()).toBe("print('v2')\n");
    expect(controller.completed).toEqual([]);
    expect(handled.message).toBe("Sent 3 files to the sandbox (1 added, 1 modified, 1 deleted) · +3 −1");
    const link = await state.link(PROJECT);
    expect(link?.pushedAt).toBe(BASELINE_AT);
    expect(link?.gotAt).toBe(SYNCED_AT);
    expect(link?.manifest).toEqual((await scanTree(host, await collectFiles(host))).manifest);
    const again = await runGet();
    expect(again.ok).toBe(true);
    expect(controller.plans[1]?.changes).toEqual([]);
    expect(controller.archives[1]?.size).toBe(0);
    expect(again.message).toBe("Sandbox already up to date");
  });

  it.runIf(POSIX)("treats an executable bit change as a modification when the link knows the bits", async () => {
    await chmod(join(host, "run.sh"), 0o755);
    await runGet();
    expect(controller.plans[0]?.changes).toEqual([{ path: "run.sh", kind: "modified", sha256: await hashPath(join(host, "run.sh")), executable: true }]);
    expect((await state.link(PROJECT))?.executable).toEqual(["run.sh"]);
    await chmod(join(host, "run.sh"), 0o644);
    await runGet();
    expect(controller.plans[1]?.changes[0]?.executable).toBe(false);
    expect((await state.link(PROJECT))?.executable).toEqual([]);
  });

  it.runIf(POSIX)("ignores executable bit changes when the link predates them", async () => {
    const link = await state.link(PROJECT);
    await state.saveLink({ ...link!, executable: null });
    await chmod(join(host, "run.sh"), 0o755);
    await write(host, "added.sh", "x");
    await chmod(join(host, "added.sh"), 0o755);
    await runGet();
    expect(controller.plans[0]?.changes.map((change) => [change.path, change.executable])).toEqual([["added.sh", true]]);
    expect((await state.link(PROJECT))?.executable).toEqual(["added.sh", "run.sh"]);
  });

  it("diffs .git by size and mtime, skipping lock files", async () => {
    await write(host, ".git/refs/heads/main", `${"b".repeat(40)}\n`);
    await utimes(join(host, ".git/refs/heads/main"), 1, 1);
    await write(host, ".git/objects/bb/two", "object two");
    await write(host, ".git/index.lock", "busy");
    await unlink(join(host, ".git/objects/aa/one"));
    await runGet();
    expect(controller.plans[0]?.git).toEqual({ changed: ["objects/bb/two", "refs/heads/main"], deleted: ["objects/aa/one"] });
    expect(new Set(controller.archives[0]?.keys())).toEqual(new Set([".git/objects/bb/two", ".git/refs/heads/main"]));
    expect(controller.contents.get(".git/refs/heads/main")?.toString()).toBe(`${"b".repeat(40)}\n`);
    expect((await state.link(PROJECT))?.gitManifest).toEqual(await gitManifest(host));
    expect((await state.link(PROJECT))?.gitManifest).not.toHaveProperty("index.lock");
  });

  it("sends the whole .git dir when the link has no git manifest", async () => {
    const link = await state.link(PROJECT);
    await state.saveLink({ ...link!, gitManifest: null });
    await runGet();
    expect(controller.plans[0]?.git).toEqual({ changed: ["HEAD", "objects/aa/one", "refs/heads/main"], deleted: [] });
  });

  it.runIf(POSIX)("does not treat a .git file or symlink as a git dir", async () => {
    await write(tmp, "worktree/.git", "gitdir: /elsewhere\n");
    expect(await gitManifest(join(tmp, "worktree"))).toBeNull();
    await mkdir(join(tmp, "real/.git"), { recursive: true });
    await mkdir(join(tmp, "linked"));
    await symlink(join(tmp, "real/.git"), join(tmp, "linked/.git"));
    expect(await gitManifest(join(tmp, "linked"))).toBeNull();
    expect(planGit(null, { HEAD: "1:1" })).toBeNull();
  });

  it.runIf(POSIX)("does not follow symlinks while walking .git", async () => {
    const outside = join(tmp, "outside");
    await write(outside, "secret", "x");
    await symlink(outside, join(host, ".git/escape"));
    await symlink(join(outside, "secret"), join(host, ".git/secret-link"));
    expect(Object.keys((await gitManifest(host)) ?? {}).some((path) => path.startsWith("escape") || path.startsWith("secret"))).toBe(false);
  });

  it.runIf(POSIX)("skips paths whose parent leaves the checkout and keeps symlinks as symlinks", async () => {
    const outside = join(tmp, "outside");
    await write(outside, "secret.txt", "secret");
    await symlink(outside, join(host, "escape"));
    await symlink("README.md", join(host, "entry.md"));
    expect(await contained(host, ["escape/secret.txt", "README.md", "../x", ".git/config", "src/app.py"])).toEqual(["README.md", "src/app.py"]);
    await runGet();
    const paths = Object.fromEntries(controller.plans[0]?.changes.map((change) => [change.path, change.kind]) ?? []);
    expect(paths).not.toHaveProperty("escape/secret.txt");
    expect(paths["entry.md"]).toBe("added");
    const entry = controller.archives[0]?.get("entry.md");
    expect(entry?.isSymlink).toBe(true);
    expect(entry?.linkname).toBe("README.md");
  });

  it("reports conflicts at plan without completing again", async () => {
    const before = await state.link(PROJECT);
    await hostEdits();
    controller.conflicts = ["src/app.py"];
    const handled = await runGet();
    expect(handled.ok).toBe(false);
    expect(handled.message).toBe("1 files changed in the sandbox");
    expect(handled.result?.conflicts).toEqual(["src/app.py"]);
    expect(controller.completed).toEqual([]);
    expect(controller.archives).toEqual([]);
    expect(await state.link(PROJECT)).toEqual(before);
  });

  it("reports a failed apply without completing again", async () => {
    const before = await state.link(PROJECT);
    await hostEdits();
    controller.applyStatus = "failed";
    const handled = await runGet();
    expect(handled.ok).toBe(false);
    expect(handled.message).toMatch(/changed in the sandbox/);
    expect(controller.completed).toEqual([]);
    expect(await state.link(PROJECT)).toEqual(before);
  });

  it.each([
    ["upload", ["README.md"]],
    ["upload", ["src/old.py"]],
    ["gitUpload", ["config"]],
  ] as const)("refuses unplanned %s %j", async (field, value) => {
    const before = await state.link(PROJECT);
    await hostEdits();
    controller[field] = [...value];
    const handled = await runGet();
    const request = controller.requests.get(handled.request.id);
    expect(handled.ok).toBe(false);
    expect(request?.status).toBe("failed");
    expect(request?.error).toMatch(/unplanned/);
    expect(controller.archives).toEqual([]);
    expect(await state.link(PROJECT)).toEqual(before);
  });

  it("fails the request when a file vanishes before the upload", async () => {
    await hostEdits();
    controller.beforeApply = () => unlink(join(host, "src/new/feature.py"));
    const handled = await runGet();
    expect(handled.ok).toBe(false);
    expect(handled.message).toContain("src/new/feature.py changed during the sync, run tesseract --get again");
    expect(controller.completed).toEqual([[handled.request.id, "failed"]]);
  });

  it("fails with the sync advice when too much changed", async () => {
    await hostEdits();
    GET_LIMITS.maxChanges = 2;
    let handled = await runGet();
    expect(handled.ok).toBe(false);
    expect(handled.message).toContain("tesseract --sync");
    expect(controller.plans).toEqual([]);
    GET_LIMITS.maxChanges = 5000;
    GET_LIMITS.maxGitPaths = 0;
    await write(host, ".git/objects/cc/three", "x");
    handled = await runGet();
    expect(handled.ok).toBe(false);
    expect(handled.message).toContain(".git files");
    expect(controller.plans).toEqual([]);
  });

  it("completes the request failed on errors", async () => {
    controller.planFailure = new NetworkError("connection refused");
    let handled = await runGet();
    expect(handled.ok).toBe(false);
    expect(handled.request.status).toBe("failed");
    expect(handled.request.error).toContain("connection refused");
    controller.planFailure = null;
    await rm(host, { recursive: true, force: true });
    handled = await runGet();
    expect(handled.request.status).toBe("failed");
    expect(handled.request.error).toContain("no longer exists");
  });

  it("shows the last get in the status", async () => {
    controller.changesOverride = (projectId) => ({ projectId, baselineAt: BASELINE_AT, changes: [], totalBytes: 0, host: null });
    const out: string[] = [];
    const io = { stdout: (line: string) => out.push(line), stderr: () => undefined };
    const environment = { stateDir: state.root, cwd: host, connect: async () => ({ api: controller, label: "sandbox" }) };
    expect(await runStatus(environment, io, { idFromName: (name) => name })).toBe(EXIT.ok);
    expect(out.join("\n")).toContain(`pushed ${BASELINE_AT} · got never`);
    await runGet();
    out.length = 0;
    await runStatus(environment, io, { idFromName: (name) => name });
    expect(out.join("\n")).toContain(`pushed ${BASELINE_AT} · got ${SYNCED_AT}`);
  });
});

describe("state", () => {
  it("keeps the executable list in step on pull and revert", async () => {
    await state.saveLink(newLink({ projectId: PROJECT, hostPath: tmp, pushedAt: BASELINE_AT, manifest: { "a.sh": "1", b: "2" }, executable: ["b"] }));
    await state.updateManifest(PROJECT, { "a.sh": "3", b: null }, { "a.sh": true });
    expect((await state.link(PROJECT))?.executable).toEqual(["a.sh"]);
    expect((await state.link(PROJECT))?.manifest).toEqual({ "a.sh": "3" });
    await state.saveLink(newLink({ projectId: PROJECT, hostPath: tmp, pushedAt: BASELINE_AT, manifest: { "a.sh": "1" } }));
    await state.updateManifest(PROJECT, { "a.sh": "3" }, { "a.sh": true });
    expect((await state.link(PROJECT))?.executable).toBeNull();
  });

  it("loads old links without the get fields and writes them like the Python app", async () => {
    await mkdir(state.root, { recursive: true });
    await writeFile(state.linksPath, JSON.stringify({ [PROJECT]: { hostPath: "/src/demo", pushedAt: BASELINE_AT, manifest: { a: "1" } } }));
    const link = await state.link(PROJECT);
    expect([link?.executable, link?.gitManifest, link?.gotAt]).toEqual([null, null, null]);
    await state.recordGet(PROJECT, { b: "2" }, ["b"], { HEAD: "1:2" }, SYNCED_AT);
    const stored = JSON.parse(await readFile(state.linksPath, "utf8"))[PROJECT];
    expect(stored).toEqual({ hostPath: "/src/demo", pushedAt: BASELINE_AT, manifest: { b: "2" }, executable: ["b"], gitManifest: { HEAD: "1:2" }, gotAt: SYNCED_AT });
    await state.recordGet("unknown", {}, [], null, SYNCED_AT);
    expect((await state.links()).has("unknown")).toBe(false);
  });
});

describe("summaries", () => {
  it("describes get results", () => {
    expect(describeResult("get", { added: 0, modified: 0, deleted: 0 })).toBe("Sandbox already up to date");
    expect(describeResult("get", { added: 0, modified: 0, deleted: 0, gitFiles: 3 })).toBe("Sandbox already up to date · updated .git (3 files)");
    expect(
      describeResult("get", { added: 1, modified: 2, deleted: 0, insertions: 12, deletions: 4, backupPath: "/data/sync/backups/demo/sync_1" }),
    ).toBe("Sent 3 files to the sandbox (1 added, 2 modified) · +12 −4 · sandbox edits kept in /data/sync/backups/demo/sync_1");
  });

  it("knows the notification kinds", () => {
    expect(notificationKind({ kind: "get" })).toBe("get");
    expect(notificationKind({ kind: "other" as never })).toBe("pull");
    expect(SYNC_BACK_TITLES.get_done("demo")).toBe("Sent demo changes to the sandbox");
  });
});

describe("host changes", () => {
  it("lists what a get would bring in", async () => {
    const root = join(tmp, "plain");
    await write(root, "same.txt", "a");
    await write(root, "edited.txt", "a");
    await write(root, "gone.txt", "a");
    const link = newLink({ projectId: PROJECT, hostPath: root, pushedAt: BASELINE_AT, manifest: await buildManifest(root, ["same.txt", "edited.txt", "gone.txt"]) });
    const digests = new DigestCache();
    expect(await hostChanges(link, digests)).toEqual([]);
    await write(root, "edited.txt", "b");
    await write(root, "new.txt", "a");
    await unlink(join(root, "gone.txt"));
    expect(await hostChanges(link, digests)).toEqual(["edited.txt", "gone.txt", "new.txt"]);
  });

  it("is empty when the host folder is missing", async () => {
    const link = newLink({ projectId: PROJECT, hostPath: join(tmp, "missing"), pushedAt: BASELINE_AT, manifest: { "a.txt": "0".repeat(64) } });
    expect(await hostChanges(link)).toEqual([]);
  });

  it("rehashes only files whose stat changed", async () => {
    await write(tmp, "a.txt", "one");
    const hashed: string[] = [];
    const digests = new DigestCache(async (path) => {
      hashed.push(path);
      return hashPath(path);
    });
    const first = await digests.hash(join(tmp, "a.txt"));
    expect(await digests.hash(join(tmp, "a.txt"))).toBe(first);
    expect(hashed).toHaveLength(1);
    await write(tmp, "a.txt", "two!");
    expect(await digests.hash(join(tmp, "a.txt"))).not.toBe(first);
    expect(hashed).toHaveLength(2);
    await unlink(join(tmp, "a.txt"));
    expect(await digests.hash(join(tmp, "a.txt"))).toBeNull();
    expect((await stat(tmp)).isDirectory()).toBe(true);
  });
});
