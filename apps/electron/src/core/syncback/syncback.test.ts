import { chmod, lstat, mkdir, readFile, readdir, readlink, rm, stat, symlink, unlink } from "node:fs/promises";
import { join } from "node:path";
import { ApiError } from "@theone/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runPull, runRevert, runStatus } from "./cli";
import type { CliIo, SyncEnvironment } from "./connect";
import { EXIT } from "./constants";
import { SyncBackError, SyncConflict } from "./errors";
import { buildManifest, hashPath, resolvePath } from "./manifest";
import { pull, pullResult } from "./pull";
import { runPush } from "./push";
import { claimable, handleRequest } from "./requests";
import { restoreBaseline, revert } from "./revert";
import { SyncBackService } from "./service";
import { SyncState, displacedCopy, newLink, savedCopy } from "./state";
import { TAR_TYPES } from "./tar";
import { FakeController, PROJECT, tarBytes, tempDir, tree, walk, write } from "./testing";

const POSIX = process.platform !== "win32";

interface Env {
  tmp: string;
  host: string;
  sandbox: string;
  state: SyncState;
  controller: FakeController;
}

let env: Env;

beforeEach(async () => {
  const tmp = await resolvePath(await tempDir("syncback"));
  const host = join(tmp, "host", PROJECT);
  const sandbox = join(tmp, "sandbox");
  for (const root of [host, sandbox]) {
    await write(root, "README.md", "hello\n");
    await write(root, "src/app.py", "print('v1')\n");
    await write(root, "src/old.py", "old\n");
  }
  await mkdir(join(host, ".git"));
  await write(host, ".git/config", "[core]\n");
  const state = new SyncState(join(tmp, "state"));
  await state.saveLink(newLink({ projectId: PROJECT, hostPath: host, pushedAt: "2026-09-30T20:00:00.000Z", manifest: await buildManifest(host, await walk(host)) }));
  const controller = new FakeController(sandbox);
  await controller.push();
  env = { tmp, host, sandbox, state, controller };
});

afterEach(async () => {
  await rm(env.tmp, { recursive: true, force: true });
});

async function sandboxEdits(sandbox: string): Promise<void> {
  await write(sandbox, "src/app.py", "print('v2')\n");
  await write(sandbox, "src/new/feature.py", "new\n");
  await unlink(join(sandbox, "src/old.py"));
}

const exists = (path: string) => lstat(path).then(() => true, () => false);
const text = (path: string) => readFile(path, "utf8");
const mode = async (path: string) => (await stat(path)).mode & 0o777;

function capture(): CliIo & { out: string[]; err: string[]; take(): { out: string; err: string } } {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    take() {
      const result = { out: out.join("\n"), err: err.join("\n") };
      out.length = 0;
      err.length = 0;
      return result;
    },
  };
}

function environment(cwd: string, controller: FakeController | null): SyncEnvironment {
  return { stateDir: env.state.root, cwd, connect: async () => (controller ? { api: controller, label: "sandbox" } : null) };
}

describe("pull", () => {
  it("applies changes, takes a snapshot and acks", async () => {
    const { host, sandbox, state, controller } = env;
    const before = await tree(host);
    await sandboxEdits(sandbox);
    const outcome = await pull(controller, state, PROJECT);
    expect([outcome.added, outcome.modified, outcome.deleted]).toEqual([["src/new/feature.py"], ["src/app.py"], ["src/old.py"]]);
    expect(await tree(host)).toEqual(await tree(sandbox));
    expect(await text(join(host, ".git/config"))).toBe("[core]\n");
    expect((await controller.syncChanges(PROJECT)).changes).toEqual([]);
    expect(Object.fromEntries((controller.acks[0] ?? []).map((ack) => [ack.path, ack.sha256]))).toEqual({
      "src/new/feature.py": await hashPath(join(sandbox, "src/new/feature.py")),
      "src/app.py": await hashPath(join(sandbox, "src/app.py")),
      "src/old.py": null,
    });
    const link = await state.link(PROJECT);
    expect(link?.manifest["src/app.py"]).toBe(await hashPath(join(host, "src/app.py")));
    expect(link?.manifest).not.toHaveProperty("src/old.py");
    const [snapshot] = await state.snapshots(PROJECT);
    expect(snapshot?.id).toBe(outcome.snapshotId);
    expect(snapshot?.reverted).toBe(false);
    expect(Object.fromEntries(snapshot?.entries.map((entry) => [entry.path, entry.before]) ?? [])).toEqual({
      "src/new/feature.py": "absent",
      "src/app.py": "file",
      "src/old.py": "file",
    });
    expect(await text(savedCopy(snapshot!, "src/app.py"))).toBe(before["src/app.py"]);
    expect(pullResult(outcome).snapshotId).toBe(outcome.snapshotId);
  });

  it("aborts on conflicts before writing", async () => {
    const { host, sandbox, state, controller } = env;
    await write(host, "src/app.py", "print('host edit')\n");
    await write(host, "src/new/feature.py", "host created this\n");
    await sandboxEdits(sandbox);
    const before = await tree(host);
    const error = await pull(controller, state, PROJECT).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SyncConflict);
    expect((error as SyncConflict).conflicts).toEqual(["src/app.py", "src/new/feature.py"]);
    expect(await tree(host)).toEqual(before);
    expect(await state.snapshots(PROJECT)).toEqual([]);
    expect(controller.acks).toEqual([]);
  });

  it("does not treat the same change on both sides as a conflict", async () => {
    const { host, sandbox, state, controller } = env;
    await write(host, "src/app.py", "print('v2')\n");
    await write(sandbox, "src/app.py", "print('v2')\n");
    const outcome = await pull(controller, state, PROJECT);
    expect(outcome.conflicts).toEqual([]);
    expect(outcome.modified).toEqual(["src/app.py"]);
  });

  it("overwrites with force and revert brings the host edit back", async () => {
    const { host, sandbox, state, controller } = env;
    await write(host, "src/app.py", "print('host edit')\n");
    await sandboxEdits(sandbox);
    const outcome = await pull(controller, state, PROJECT, { force: true });
    expect(outcome.conflicts).toEqual(["src/app.py"]);
    expect(await text(join(host, "src/app.py"))).toBe("print('v2')\n");
    await revert(state, PROJECT);
    expect(await text(join(host, "src/app.py"))).toBe("print('host edit')\n");
  });

  const member = (name: string, type: string = TAR_TYPES.file, linkname = "") => ({ name, type, linkname });
  it.each([
    [member("../escape.txt"), "plain relative path"],
    [member("/tmp/abs.txt"), "absolute"],
    [member("src/other.py"), "unexpected"],
    [member("src/app.py", TAR_TYPES.symlink, "../../../etc/passwd"), "outside the project"],
    [member("src/app.py", TAR_TYPES.symlink, "/etc/passwd"), "outside the project"],
    [member("src/app.py", TAR_TYPES.hardlink, "README.md"), "only regular files"],
    [member("src/app.py", TAR_TYPES.char), "only regular files"],
    [member("src/app.py", TAR_TYPES.fifo), "only regular files"],
  ])("rejects an export tar with %o", async (entry, message) => {
    const { host, sandbox, state, controller } = env;
    await write(sandbox, "src/app.py", "print('v2')\n");
    const data = entry.type === TAR_TYPES.file ? Buffer.from("x") : undefined;
    controller.exportOverride = await tarBytes((writer) =>
      writer.addEntry({ name: entry.name, type: entry.type, mode: 0o644, size: data?.length ?? 0, linkname: entry.linkname, mtime: 0 }, data),
    );
    const before = await tree(host);
    await expect(pull(controller, state, PROJECT)).rejects.toThrow(new RegExp(message));
    expect(await tree(host)).toEqual(before);
    expect(await exists(join(host, "..", "escape.txt"))).toBe(false);
    expect(await state.snapshots(PROJECT)).toEqual([]);
  });

  it("rejects an unreadable export archive", async () => {
    const { sandbox, state, controller } = env;
    await write(sandbox, "src/app.py", "print('v2')\n");
    controller.exportOverride = Buffer.from([0x1f, 0x8b, 1, 2, 3, 4, 5, 6, 7, 8]);
    await expect(pull(controller, state, PROJECT)).rejects.toThrow(/unreadable archive/);
  });

  it.runIf(POSIX)("accepts an in-tree symlink", async () => {
    const { host, sandbox, state, controller } = env;
    await symlink("../README.md", join(sandbox, "src/readme-link"));
    await pull(controller, state, PROJECT);
    expect(await readlink(join(host, "src/readme-link"))).toBe("../README.md");
  });

  it.each(["../outside.txt", ".git/config", "a/./b", "/etc/passwd"])("rejects the unsafe change path %s", async (path) => {
    const { state, controller } = env;
    controller.changesOverride = (projectId) => ({
      projectId,
      baselineAt: "x",
      changes: [{ path, kind: "added", sha256: "0", size: 1 }],
      totalBytes: 1,
      host: null,
    });
    await expect(pull(controller, state, PROJECT)).rejects.toBeInstanceOf(SyncBackError);
  });

  it.runIf(POSIX)("rejects a symlinked parent that leaves the checkout", async () => {
    const { tmp, host, sandbox, state, controller } = env;
    const outside = join(tmp, "outside");
    await mkdir(outside);
    await symlink(outside, join(host, "linked"));
    await write(sandbox, "linked/x.txt", "x");
    await expect(pull(controller, state, PROJECT)).rejects.toThrow(/leaves/);
    expect(await readdir(outside)).toEqual([]);
  });

  it.runIf(POSIX)("never writes through symlinks from the same export", async () => {
    const { tmp, host, sandbox, state, controller } = env;
    const outside = join(tmp, "host", "outside");
    await mkdir(outside, { recursive: true });
    await mkdir(join(sandbox, "D"), { recursive: true });
    await symlink("..", join(sandbox, "D/up"));
    await symlink("up/../../outside", join(sandbox, "D/esc"));
    controller.exportOverride = await tarBytes(async (writer) => {
      await writer.addEntry({ name: "D/up", type: TAR_TYPES.symlink, mode: 0o777, size: 0, linkname: "..", mtime: 0 });
      await writer.addEntry({ name: "D/esc", type: TAR_TYPES.symlink, mode: 0o777, size: 0, linkname: "up/../../outside", mtime: 0 });
      await writer.addEntry({ name: "D/esc/pwned", type: TAR_TYPES.file, mode: 0o644, size: 1, linkname: "", mtime: 0 }, Buffer.from("x"));
    });
    controller.changesOverride = (projectId) => ({
      projectId,
      baselineAt: "x",
      changes: ["D/up", "D/esc", "D/esc/pwned"].map((path) => ({ path, kind: "added", sha256: "0", size: 1 })),
      totalBytes: 3,
      host: null,
    });
    const before = await tree(host);
    await expect(pull(controller, state, PROJECT, { force: true })).rejects.toBeInstanceOf(SyncBackError);
    expect(await readdir(outside)).toEqual([]);
    expect(await tree(host)).toEqual(before);
    expect(await exists(join(host, "D"))).toBe(false);
  });

  it.runIf(POSIX)("rejects a symlink chain that points outside even without nested files", async () => {
    const { host, state, controller } = env;
    controller.exportOverride = await tarBytes(async (writer) => {
      await writer.addEntry({ name: "D/up", type: TAR_TYPES.symlink, mode: 0o777, size: 0, linkname: "..", mtime: 0 });
      await writer.addEntry({ name: "D/esc", type: TAR_TYPES.symlink, mode: 0o777, size: 0, linkname: "up/../../outside", mtime: 0 });
    });
    controller.changesOverride = (projectId) => ({
      projectId,
      baselineAt: "x",
      changes: ["D/up", "D/esc"].map((path) => ({ path, kind: "added", sha256: "0", size: 1 })),
      totalBytes: 2,
      host: null,
    });
    await expect(pull(controller, state, PROJECT, { force: true })).rejects.toThrow(/outside the project/);
    expect(await exists(join(host, "D"))).toBe(false);
  });

  it.runIf(POSIX)("pulls over and reverts read-only host files", async () => {
    const { host, sandbox, state, controller } = env;
    await chmod(join(host, "src/app.py"), 0o444);
    await chmod(join(host, "src/old.py"), 0o444);
    await sandboxEdits(sandbox);
    await pull(controller, state, PROJECT);
    expect(await text(join(host, "src/app.py"))).toBe("print('v2')\n");
    expect(await mode(join(host, "src/app.py"))).toBe(0o444);
    expect(await exists(join(host, "src/old.py"))).toBe(false);
    await revert(state, PROJECT);
    expect(await text(join(host, "src/app.py"))).toBe("print('v1')\n");
    expect(await mode(join(host, "src/old.py"))).toBe(0o444);
  });

  it("writes nothing on a dry run", async () => {
    const { host, sandbox, state, controller } = env;
    await sandboxEdits(sandbox);
    await write(host, "src/app.py", "host edit\n");
    const before = await tree(host);
    const outcome = await pull(controller, state, PROJECT, { dryRun: true });
    expect(outcome.dryRun).toBe(true);
    expect(outcome.added.length + outcome.modified.length + outcome.deleted.length).toBe(3);
    expect(outcome.conflicts).toEqual(["src/app.py"]);
    expect(await tree(host)).toEqual(before);
    expect(await state.snapshots(PROJECT)).toEqual([]);
    expect(controller.acks).toEqual([]);
  });

  it("limits the pull to the requested paths", async () => {
    const { host, sandbox, state, controller } = env;
    await sandboxEdits(sandbox);
    const outcome = await pull(controller, state, PROJECT, { paths: ["src/app.py"] });
    expect(outcome.modified).toEqual(["src/app.py"]);
    expect(outcome.added.length + outcome.deleted.length).toBe(0);
    expect(await exists(join(host, "src/old.py"))).toBe(true);
    expect((await controller.syncChanges(PROJECT)).changes.map((change) => change.path)).toEqual(["src/new/feature.py", "src/old.py"]);
  });

  it.runIf(POSIX)("keeps host permissions but takes the executable bit from the sandbox", async () => {
    const { host, sandbox, state, controller } = env;
    await chmod(join(host, "src/app.py"), 0o600);
    await chmod(join(host, "README.md"), 0o755);
    await write(sandbox, "src/app.py", "print('v2')\n");
    await chmod(join(sandbox, "src/app.py"), 0o755);
    await write(sandbox, "README.md", "hello v2\n");
    await chmod(join(sandbox, "README.md"), 0o644);
    await write(sandbox, "run.sh", "#!/bin/sh\n");
    await chmod(join(sandbox, "run.sh"), 0o750);
    await pull(controller, state, PROJECT);
    expect(await mode(join(host, "src/app.py"))).toBe(0o700);
    expect(await mode(join(host, "README.md"))).toBe(0o644);
    expect(await mode(join(host, "run.sh"))).toBe(0o750);
    const acked = Object.fromEntries((controller.acks[0] ?? []).map((change) => [change.path, change]));
    expect(acked["src/app.py"]?.executable).toBe(true);
    expect(acked["README.md"]?.executable).toBe(false);
    await revert(state, PROJECT);
    expect(await mode(join(host, "src/app.py"))).toBe(0o600);
    expect(await mode(join(host, "README.md"))).toBe(0o755);
  });

  it("keeps only the newest 20 snapshots", async () => {
    const { sandbox, state, controller } = env;
    for (let n = 0; n < 22; n += 1) {
      await write(sandbox, "src/app.py", `print(${n})\n`);
      await pull(controller, state, PROJECT);
    }
    const snapshots = await state.snapshots(PROJECT);
    expect(snapshots).toHaveLength(20);
    expect(new Set(snapshots.map((snapshot) => snapshot.id)).size).toBe(20);
  }, 30_000);

  it("fails for an unlinked project", async () => {
    await expect(pull(new FakeController(env.tmp), new SyncState(join(env.tmp, "empty")), PROJECT)).rejects.toThrow(/monolith --sync/);
  });
});

describe("revert", () => {
  it("restores modified, added and deleted files", async () => {
    const { host, sandbox, state, controller } = env;
    const before = await tree(host);
    await sandboxEdits(sandbox);
    await pull(controller, state, PROJECT);
    const outcome = await revert(state, PROJECT);
    expect(await tree(host)).toEqual(before);
    expect(await exists(join(host, "src/new"))).toBe(false);
    expect([outcome.restored, outcome.recreated, outcome.removed]).toEqual([["src/app.py"], ["src/old.py"], ["src/new/feature.py"]]);
    expect((await state.snapshots(PROJECT))[0]?.reverted).toBe(true);
    await expect(revert(state, PROJECT)).rejects.toThrow(/no sync to revert/);
  });

  it("walks back one pull at a time", async () => {
    const { host, sandbox, state, controller } = env;
    const original = await tree(host);
    await write(sandbox, "src/app.py", "print('v2')\n");
    const first = await pull(controller, state, PROJECT);
    const afterFirst = await tree(host);
    await write(sandbox, "src/app.py", "print('v3')\n");
    await write(sandbox, "extra.txt", "e\n");
    const second = await pull(controller, state, PROJECT);
    expect(first.snapshotId).not.toBe(second.snapshotId);
    expect((await revert(state, PROJECT)).snapshotId).toBe(second.snapshotId);
    expect(await tree(host)).toEqual(afterFirst);
    expect((await revert(state, PROJECT)).snapshotId).toBe(first.snapshotId);
    expect(await tree(host)).toEqual(original);
  });

  it("refuses when the host was edited after the pull, and keeps the edit with force", async () => {
    const { host, sandbox, state, controller } = env;
    await write(sandbox, "src/app.py", "print('v2')\n");
    await pull(controller, state, PROJECT);
    await write(host, "src/app.py", "print('edited after pull')\n");
    const error = await revert(state, PROJECT).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SyncConflict);
    expect((error as SyncConflict).conflicts).toEqual(["src/app.py"]);
    expect(await text(join(host, "src/app.py"))).toBe("print('edited after pull')\n");
    const outcome = await revert(state, PROJECT, true);
    expect(await text(join(host, "src/app.py"))).toBe("print('v1')\n");
    expect(outcome.displaced).toEqual(["src/app.py"]);
    expect(await text(join(outcome.displacedDir as string, "src/app.py"))).toBe("print('edited after pull')\n");
    const [snapshot] = await state.snapshots(PROJECT);
    expect(outcome.displacedDir).toBe(displacedCopy(snapshot!, ""));
  });

  it("puts the baseline back so the changes are offered again", async () => {
    const { host, sandbox, state, controller } = env;
    const before = await tree(host);
    await sandboxEdits(sandbox);
    await pull(controller, state, PROJECT);
    expect((await controller.syncChanges(PROJECT)).changes).toEqual([]);
    const outcome = await revert(state, PROJECT);
    await restoreBaseline(controller, outcome);
    expect(await tree(host)).toEqual(before);
    expect(outcome.warnings).toEqual([]);
    const offered = Object.fromEntries((await controller.syncChanges(PROJECT)).changes.map((change) => [change.path, change.kind]));
    expect(offered).toEqual({ "src/app.py": "modified", "src/new/feature.py": "added", "src/old.py": "deleted" });
    const again = await pull(controller, state, PROJECT);
    expect(again.conflicts).toEqual([]);
    expect(await tree(host)).toEqual(await tree(sandbox));
  });

  it("still protects the host edit after reverting a forced pull", async () => {
    const { host, sandbox, state, controller } = env;
    await write(host, "src/app.py", "print('host edit')\n");
    await sandboxEdits(sandbox);
    await pull(controller, state, PROJECT, { force: true });
    await restoreBaseline(controller, await revert(state, PROJECT));
    expect(await text(join(host, "src/app.py"))).toBe("print('host edit')\n");
    const error = await pull(controller, state, PROJECT).catch((caught: unknown) => caught);
    expect((error as SyncConflict).conflicts).toEqual(["src/app.py"]);
  });

  it("reverts without the sandbox and warns", async () => {
    const { host, sandbox, state, controller } = env;
    const before = await tree(host);
    await sandboxEdits(sandbox);
    await pull(controller, state, PROJECT);
    const outcome = await revert(state, PROJECT);
    await restoreBaseline(null, outcome);
    expect(await tree(host)).toEqual(before);
    expect(outcome.warnings[0]).toMatch(/not offer/);
  });
});

describe("request handling", () => {
  it("applies and completes pull and revert requests", async () => {
    const { host, sandbox, state, controller } = env;
    await sandboxEdits(sandbox);
    const request = controller.addRequest("pull");
    expect(await claimable(request, state)).toBe(true);
    const handled = await handleRequest(controller, state, request, "laptop");
    expect(handled.ok).toBe(true);
    const stored = controller.requests.get(request.id);
    expect(stored?.status).toBe("applied");
    expect(stored?.claimedBy).toBe("laptop");
    expect(stored?.result).toMatchObject({ added: 1, modified: 1, deleted: 1, snapshotId: (await state.snapshots(PROJECT))[0]?.id });

    const revertRequest = controller.addRequest("revert");
    expect((await handleRequest(controller, state, revertRequest, "laptop")).ok).toBe(true);
    expect(controller.requests.get(revertRequest.id)?.result?.modified).toBe(1);
    expect(await exists(join(host, "src/old.py"))).toBe(true);
    expect((await controller.syncChanges(PROJECT)).changes).toHaveLength(3);
  });

  it("fails a conflicting request with the list, and a forced one applies", async () => {
    const { host, sandbox, state, controller } = env;
    await write(host, "src/app.py", "host edit\n");
    await sandboxEdits(sandbox);
    const request = controller.addRequest("pull");
    const handled = await handleRequest(controller, state, request, "laptop");
    const stored = controller.requests.get(request.id);
    expect(handled.ok).toBe(false);
    expect(stored?.status).toBe("failed");
    expect(stored?.result?.conflicts).toEqual(["src/app.py"]);
    expect(stored?.error).toMatch(/changed on the host/);
    expect((await handleRequest(controller, state, controller.addRequest("pull", true), "laptop")).ok).toBe(true);
  });

  it("does not claim requests for unlinked projects", async () => {
    expect(await claimable(env.controller.addRequest("pull"), new SyncState(join(env.tmp, "empty")))).toBe(false);
  });

  it("propagates a request that was already claimed", async () => {
    const { state, controller } = env;
    const request = controller.addRequest("pull");
    await controller.claimRequest(request.id, "other");
    await expect(handleRequest(controller, state, request, "laptop")).rejects.toBeInstanceOf(ApiError);
  });

  it("redacts confidential host paths", async () => {
    const { host, sandbox, state, controller } = env;
    const link = await state.link(PROJECT);
    await state.saveLink({ ...link!, confidential: true });
    await write(host, "src/app.py", "host edit\n");
    await sandboxEdits(sandbox);
    const request = controller.addRequest("pull");
    await handleRequest(controller, state, request, "laptop");
    const stored = controller.requests.get(request.id);
    expect(stored?.result?.hostPath).toBe("REDACTED");
    expect(stored?.error).not.toContain(host);
    const applied = controller.addRequest("pull", true);
    const done = await handleRequest(controller, state, applied, "laptop");
    expect(done.message).toContain("REDACTED");
    expect(controller.requests.get(applied.id)?.result?.hostPath).toBe("REDACTED");
  });
});

describe("cli", () => {
  it("pulls, reverts and shows the status", async () => {
    const { host, sandbox, controller } = env;
    await sandboxEdits(sandbox);
    const io = capture();
    const ids = { idFromName: (name: string) => name };
    expect(await runStatus(environment(host, controller), io, ids)).toBe(EXIT.ok);
    expect(io.take().out).toContain("M src/app.py");

    await write(host, "src/app.py", "host edit\n");
    expect(await runPull(environment(host, controller), io, { dryRun: true, force: false, ...ids })).toBe(EXIT.conflict);
    let captured = io.take();
    expect(captured.out).toContain("Would pull 3 files");
    expect(captured.err).toContain("src/app.py");
    expect(await runPull(environment(host, controller), io, { dryRun: false, force: false, ...ids })).toBe(EXIT.conflict);
    expect(await runPull(environment(host, controller), io, { dryRun: false, force: true, ...ids })).toBe(EXIT.ok);
    const out = io.take().out;
    expect(out).toContain(`Pulled 3 files into ${host} (1 added, 1 modified, 1 deleted) · snapshot`);
    expect(out).toContain("undo with monolith --revert");
    await write(host, "src/app.py", "edited after the pull\n");
    expect(await runRevert(environment(host, controller), io, { force: false, ...ids })).toBe(EXIT.conflict);
    const err = io.take().err;
    expect(err).toContain("Nothing was reverted");
    expect(err).not.toContain("snapshot is still taken");
    expect(await runRevert(environment(host, controller), io, { force: true, ...ids })).toBe(EXIT.ok);
    captured = io.take();
    expect(captured.out).toContain("Reverted snapshot");
    expect(captured.out).toContain("copies are in");
    expect(captured.err).toBe("");
    expect((await controller.syncChanges(PROJECT)).changes).toHaveLength(3);
    expect(await runRevert(environment(host, null), io, { force: false, ...ids })).toBe(EXIT.error);
    io.take();
    expect(await runPull(environment(join(host, ".."), controller), io, { dryRun: false, force: false, ...ids })).toBe(EXIT.error);
    expect(io.take().err).toContain("monolith --sync");
  });

  it("records the link and the host manifest on push", async () => {
    const root = join(env.tmp, "My App");
    await write(root, "index.ts", "x");
    await write(root, ".git/HEAD", "ref");
    const pusher = new FakeController(env.tmp);
    const io = capture();
    expect(await runPush(environment(root, pusher), io, { confidential: false })).toBe(EXIT.ok);
    const link = await env.state.link("my-app");
    expect(link?.hostPath).toBe(root);
    expect(link?.manifest).toEqual({ "index.ts": await hashPath(join(root, "index.ts")) });
    expect(link?.gitManifest && Object.keys(link.gitManifest)).toEqual(["HEAD"]);
    expect(link?.gotAt).toBeNull();
    expect(io.out[0]).toBe(`Syncing ${root} to my-app on sandbox…`);
    expect(io.out[1]).toMatch(/^Created \/workspace\/projects\/my-app \(\d+ entries\) · linked for sync back$/);
    expect([...(pusher.pushes[0]?.members.keys() ?? [])]).toEqual(expect.arrayContaining([".git/HEAD", "index.ts"]));
  });

  it("re-links a folder under a pseudonym on a confidential push", async () => {
    const root = join(env.tmp, "secret-app");
    await write(root, "a.txt", "a");
    const pusher = new FakeController(env.tmp);
    const io = capture();
    await runPush(environment(root, pusher), io, { confidential: false });
    expect(await runPush(environment(root, pusher), io, { confidential: true })).toBe(EXIT.ok);
    const link = await env.state.linkForPath(root);
    expect(link?.confidential).toBe(true);
    expect(link?.projectId).toMatch(/^[a-z]+-[a-z]+$/);
    expect(await env.state.link("secret-app")).toBeNull();
    expect(io.err.at(-1)).toContain("rm -rf /workspace/projects/secret-app");
    expect(pusher.pushes.at(-1)?.confidential).toBe(true);
  });
});

describe("service", () => {
  it("claims linked requests once and notifies", async () => {
    const { host, sandbox, state, controller } = env;
    await sandboxEdits(sandbox);
    const sent: string[] = [];
    const service = new SyncBackService({ state, api: () => controller, host: "laptop", notify: (projectId) => sent.push(`sync-${projectId}`) });
    const request = controller.addRequest("pull");
    service.handleEvent({ type: "sync.updated", request: { ...request } });
    service.handleEvent({ type: "sync.updated", request: { ...request } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await service.idle();
    expect(controller.requests.get(request.id)?.status).toBe("applied");
    expect(sent).toEqual([`sync-${PROJECT}`]);
    expect(await exists(join(host, "src/new/feature.py"))).toBe(true);
    await service.enqueueAll(await service.beat());
    expect(controller.heartbeats.at(-1)?.projects).toEqual([PROJECT]);
    expect(controller.heartbeats.at(-1)?.changes).toEqual({ [PROJECT]: 0 });
    expect(service.snapshot().revision).toBeGreaterThan(0);
    expect(service.snapshot().busy).toEqual([]);
  });

  it("submits a desktop request and applies it itself", async () => {
    const { sandbox, state, controller } = env;
    await sandboxEdits(sandbox);
    const states: string[][] = [];
    const service = new SyncBackService({ state, api: () => controller, host: "laptop", notify: () => undefined, onChange: (next) => states.push(next.busy) });
    const created = await service.submit(PROJECT, "pull", { paths: [] });
    await service.idle();
    expect(created.source).toBe("desktop");
    expect(controller.requests.get(created.id)?.status).toBe("applied");
    expect(states.some((busy) => busy.includes(PROJECT))).toBe(true);
  });

  it("notifies a failure without an api and retries later", async () => {
    const { state, controller } = env;
    const bodies: string[] = [];
    let api: FakeController | null = null;
    const service = new SyncBackService({ state, api: () => api, host: "laptop", notify: (_id, title, body) => bodies.push(`${title}: ${body}`) });
    const request = controller.addRequest("pull");
    await service.enqueue(request);
    await service.idle();
    expect(bodies[0]).toMatch(/^Couldn't sync demo to this computer: No sandbox is configured/);
    api = controller;
    await service.enqueue(request);
    await service.idle();
    expect(controller.requests.get(request.id)?.status).toBe("applied");
  });
});
