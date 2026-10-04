import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, statSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import {
  SyncChangesSchema,
  SyncGetPlanResponseSchema,
  SyncRequestSchema,
  type SyncGetChange,
  type SyncGetPlan,
  type SyncGetPlanResponse,
  type SyncRequest,
} from "@theone/protocol";
import { runCli, type Output } from "../src/cli/commands";
import { makeTempDir, removeTempDirs, startTestController, TEST_TOKEN, writeFiles, type TestController } from "./helpers";

let t: TestController;
let projects: string;

const HOST = "laptop";
const sha256 = (value: string) => new Bun.CryptoHasher("sha256").update(value).digest("hex");

function git(cwd: string, ...args: string[]): string {
  const result = Bun.spawnSync(
    ["git", "-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "init.defaultBranch=main", "-c", "commit.gpgsign=false", ...args],
    { cwd, stdout: "pipe", stderr: "pipe" },
  );
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString()}`);
  return result.stdout.toString().trim();
}

function tar(cwd: string, members: string[]): Uint8Array {
  const result = Bun.spawnSync(["tar", "-c", "-z", "-f", "-", "--no-recursion", "-C", cwd, ...(members.length > 0 ? ["--", ...members] : ["-T", "/dev/null"])], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) throw new Error(`tar failed: ${result.stderr.toString()}`);
  return result.stdout;
}

async function push(id: string, source: string): Promise<void> {
  const archive = Bun.spawnSync(["tar", "-c", "-z", "-f", "-", "-C", source, "."], { stdout: "pipe" }).stdout;
  const pushed = await fetch(`${t.baseUrl}/v1/projects/${id}/sync`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TEST_TOKEN}`, "Content-Type": "application/gzip" },
    body: archive,
  });
  expect(pushed.status).toBeLessThan(300);
}

const write = (change: { path: string; content: string; executable?: boolean }): SyncGetChange => ({
  path: change.path,
  kind: "modified",
  sha256: sha256(change.content),
  executable: change.executable ?? false,
});
const added = (path: string, content: string, executable = false): SyncGetChange => ({ ...write({ path, content, executable }), kind: "added" });
const modified = (path: string, content: string, executable = false): SyncGetChange => write({ path, content, executable });
const deleted = (path: string): SyncGetChange => ({ path, kind: "deleted", sha256: null, executable: false });

async function createGet(id: string, force = false): Promise<SyncRequest> {
  const { status, body } = await t.json("POST", `/v1/projects/${id}/sync/requests`, { kind: "get", force, source: "cli" });
  expect(status).toBe(201);
  const created = SyncRequestSchema.parse(body);
  const claimed = await t.json("POST", `/v1/sync/requests/${created.id}/claim`, { host: HOST });
  expect(claimed.status).toBe(200);
  return SyncRequestSchema.parse(claimed.body);
}

async function plan(id: string, body: SyncGetPlan): Promise<{ status: number; response: SyncGetPlanResponse | null; body: unknown }> {
  const { status, body: json } = await t.json("POST", `/v1/sync/requests/${id}/plan`, body);
  return { status, response: status === 200 ? SyncGetPlanResponseSchema.parse(json) : null, body: json };
}

async function apply(id: string, archive: Uint8Array): Promise<{ status: number; request: SyncRequest | null; body: unknown }> {
  const response = await fetch(`${t.baseUrl}/v1/sync/requests/${id}/apply`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TEST_TOKEN}`, "Content-Type": "application/gzip" },
    body: archive,
  });
  const json = (await response.json()) as unknown;
  return { status: response.status, request: response.status === 200 ? SyncRequestSchema.parse(json) : null, body: json };
}

/** What the desktop companion does for a claimed get: plan, then send what the controller asks for. */
async function get(id: string, host: string, changes: SyncGetChange[], options: { force?: boolean; git?: SyncGetPlan["git"] } = {}): Promise<SyncRequest> {
  const request = await createGet(id, options.force);
  const planned = await plan(request.id, { hostPath: host, changes, git: options.git ?? null });
  expect(planned.status).toBe(200);
  if (planned.response!.request.status === "failed") return planned.response!.request;
  const members = [...planned.response!.upload, ...planned.response!.gitUpload.map((path) => `.git/${path}`)];
  const applied = await apply(request.id, tar(host, members));
  expect(applied.status).toBe(200);
  return applied.request!;
}

function gitFiles(root: string, prefix = ""): string[] {
  return readdirSync(join(root, ".git", prefix), { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? gitFiles(root, rel) : [rel];
  });
}

async function changes(id: string) {
  const { body } = await t.json("GET", `/v1/projects/${id}/sync/changes`);
  return SyncChangesSchema.parse(body);
}

const sandbox = (id: string, path: string) => join(projects, id, path);
const read = (id: string, path: string) => readFileSync(sandbox(id, path), "utf8");

beforeAll(async () => {
  const workspace = makeTempDir("sync-get");
  projects = join(workspace, "projects");
  t = await startTestController({ workspace });
});

afterAll(async () => {
  await t.stop();
  removeTempDirs();
});

describe("get: plan and apply", () => {
  let host: string;

  beforeAll(async () => {
    host = makeTempDir("get-host");
    writeFiles(host, {
      "README.md": "# app\n",
      "src/a.ts": "line 1\nline 2\nline 3\n",
      "src/old.ts": "old 1\nold 2\n",
      "deep/nested/gone.txt": "gone\n",
      "logo.bin": "\u0000\u0001binary",
      "run.sh": "echo hi\n",
    });
    await push("app", host);
  });

  test("applies adds, edits, deletes, binaries and mode changes with git style stats", async () => {
    writeFiles(host, { "src/a.ts": "line 1\nline two\nline 3\nline 4\n", "src/new.ts": "n1\nn2\n", "logo.bin": "\u0000\u0002binary!" });
    chmodSync(join(host, "run.sh"), 0o755);
    const before = Date.now();
    const request = await get("app", host, [
      modified("src/a.ts", "line 1\nline two\nline 3\nline 4\n"),
      added("src/new.ts", "n1\nn2\n"),
      deleted("src/old.ts"),
      deleted("deep/nested/gone.txt"),
      modified("logo.bin", "\u0000\u0002binary!"),
      modified("run.sh", "echo hi\n", true),
    ]);
    expect(request.status).toBe("applied");
    const result = request.result!;
    expect({ added: result.added, modified: result.modified, deleted: result.deleted, insertions: result.insertions, deletions: result.deletions }).toEqual({
      added: 1,
      modified: 3,
      deleted: 2,
      insertions: 4,
      deletions: 4,
    });
    expect(result.files).toEqual([
      { path: "deep/nested/gone.txt", kind: "deleted", insertions: 0, deletions: 1, binary: false, oldMode: "100644", newMode: null, oldSize: 5, newSize: null },
      { path: "logo.bin", kind: "modified", insertions: 0, deletions: 0, binary: true, oldMode: "100644", newMode: "100644", oldSize: 8, newSize: 9 },
      { path: "run.sh", kind: "modified", insertions: 0, deletions: 0, binary: false, oldMode: "100644", newMode: "100755", oldSize: 8, newSize: 8 },
      { path: "src/a.ts", kind: "modified", insertions: 2, deletions: 1, binary: false, oldMode: "100644", newMode: "100644", oldSize: 21, newSize: 30 },
      { path: "src/new.ts", kind: "added", insertions: 2, deletions: 0, binary: false, oldMode: null, newMode: "100644", oldSize: null, newSize: 6 },
      { path: "src/old.ts", kind: "deleted", insertions: 0, deletions: 2, binary: false, oldMode: "100644", newMode: null, oldSize: 12, newSize: null },
    ]);
    expect(result.hostPath).toBe(host);
    expect(result.conflicts).toEqual([]);
    expect(result.backupPath).toBeNull();
    expect(Date.parse(result.syncedAt!)).toBeGreaterThanOrEqual(before - 1000);
    expect(result.previousSyncAt).toBeString();

    expect(read("app", "src/a.ts")).toBe("line 1\nline two\nline 3\nline 4\n");
    expect(read("app", "src/new.ts")).toBe("n1\nn2\n");
    expect(existsSync(sandbox("app", "src/old.ts"))).toBe(false);
    expect(existsSync(sandbox("app", "deep"))).toBe(false);
    expect(statSync(sandbox("app", "run.sh")).mode & 0o111).not.toBe(0);

    const after = await changes("app");
    expect(after.changes).toEqual([]);
    expect(after.lastGetAt).toBe(result.syncedAt!);
  });

  test("nothing to do still records the time, and the previous sync is the last get", async () => {
    const last = (await changes("app")).lastGetAt!;
    const request = await get("app", host, []);
    expect(request.status).toBe("applied");
    expect(request.result!.files).toEqual([]);
    expect(request.result!.previousSyncAt).toBe(last);
    expect((await changes("app")).lastGetAt).toBe(request.result!.syncedAt!);
  });

  test("a file the sandbox already has is not uploaded", async () => {
    writeFiles(host, { "same.txt": "same\n" });
    writeFiles(join(projects, "app"), { "same.txt": "same\n" });
    const request = await createGet("app");
    const planned = await plan(request.id, { hostPath: host, changes: [added("same.txt", "same\n")], git: null });
    expect(planned.response!.upload).toEqual([]);
    const applied = await apply(request.id, tar(host, []));
    expect(applied.request!.status).toBe("applied");
    expect(applied.request!.result!.files).toEqual([]);
    expect((await changes("app")).changes).toEqual([]);
  });

  test("sandbox edits to the same files are conflicts; nothing is written without force", async () => {
    writeFiles(host, { "README.md": "# app from host\n", "src/new.ts": "n1\nhost\n" });
    writeFiles(join(projects, "app"), { "README.md": "# app from sandbox\n" });
    const planChanges = [modified("README.md", "# app from host\n"), modified("src/new.ts", "n1\nhost\n")];
    const failed = await get("app", host, planChanges);
    expect(failed.status).toBe("failed");
    expect(failed.result!.conflicts).toEqual(["README.md"]);
    expect(failed.error).toContain("1 file changed in the sandbox since the last sync: README.md");
    expect(read("app", "README.md")).toBe("# app from sandbox\n");
    expect(read("app", "src/new.ts")).toBe("n1\nn2\n");

    const forced = await get("app", host, planChanges, { force: true });
    expect(forced.status).toBe("applied");
    expect(forced.result!.conflicts).toEqual(["README.md"]);
    expect(read("app", "README.md")).toBe("# app from host\n");
    expect(readFileSync(join(forced.result!.backupPath!, "README.md"), "utf8")).toBe("# app from sandbox\n");
  });

  test("sandbox-only edits elsewhere stay offered for sync back", async () => {
    writeFiles(join(projects, "app"), { "sandbox-only.txt": "mine\n" });
    writeFiles(host, { "src/a.ts": "host again\n" });
    const request = await get("app", host, [modified("src/a.ts", "host again\n")]);
    expect(request.status).toBe("applied");
    expect((await changes("app")).changes.map((change) => `${change.kind} ${change.path}`)).toEqual(["added sandbox-only.txt"]);
    rmSync(sandbox("app", "sandbox-only.txt"));
  });

  test("symlinks are applied as symlinks; the same path deleted on both sides is a no-op", async () => {
    symlinkSync("src/a.ts", join(host, "link"));
    rmSync(sandbox("app", "src/new.ts"));
    const request = await get("app", host, [
      { path: "link", kind: "added", sha256: sha256("src/a.ts"), executable: false },
      deleted("src/new.ts"),
    ], { force: true });
    expect(request.status).toBe("applied");
    expect(readlinkSync(sandbox("app", "link"))).toBe("src/a.ts");
    expect(request.result!.files!.map((file) => [file.path, file.kind, file.newMode])).toEqual([["link", "added", "120000"]]);
  });

  test("a failure midway rolls every file back", async () => {
    writeFiles(host, { "README.md": "rolled back?\n", "locked/new.txt": "x\n" });
    mkdirSync(sandbox("app", "locked"));
    chmodSync(sandbox("app", "locked"), 0o555);
    try {
      const request = await createGet("app");
      const planned = await plan(request.id, { hostPath: host, changes: [modified("README.md", "rolled back?\n"), added("locked/new.txt", "x\n")], git: null });
      const applied = await apply(request.id, tar(host, planned.response!.upload));
      expect(applied.status).toBe(500);
      expect(JSON.stringify(applied.body)).toContain("nothing was changed");
      expect(read("app", "README.md")).toBe("# app from host\n");
      const completed = await t.json("POST", `/v1/sync/requests/${request.id}/complete`, { status: "failed", error: "apply failed" });
      expect(completed.status).toBe(200);
    } finally {
      chmodSync(sandbox("app", "locked"), 0o755);
      rmSync(sandbox("app", "locked"), { recursive: true });
    }
  });
});

describe("get: validation", () => {
  let host: string;

  beforeAll(async () => {
    host = makeTempDir("get-validate-host");
    writeFiles(host, { "a.txt": "a\n" });
    await push("checked", host);
  });

  test("only claimed get requests can be planned, and only planned ones applied", async () => {
    const pull = await t.json("POST", "/v1/projects/checked/sync/requests", { kind: "revert" });
    const pullId = SyncRequestSchema.parse(pull.body).id;
    expect((await plan(pullId, { hostPath: host, changes: [], git: null })).status).toBe(409);
    await t.json("POST", `/v1/sync/requests/${pullId}/cancel`);

    const request = await createGet("checked");
    expect((await apply(request.id, tar(host, []))).status).toBe(409);
    await t.json("POST", `/v1/sync/requests/${request.id}/complete`, { status: "failed", error: "test" });
  });

  test("bad plans are refused", async () => {
    const request = await createGet("checked");
    const dup = await plan(request.id, { hostPath: host, changes: [modified("a.txt", "x"), modified("a.txt", "y")], git: null });
    expect(dup.status).toBe(400);
    const nullHash = await plan(request.id, { hostPath: host, changes: [{ path: "a.txt", kind: "modified", sha256: null, executable: false }], git: null });
    expect(nullHash.status).toBe(400);
    const unsafe = await t.json("POST", `/v1/sync/requests/${request.id}/plan`, { hostPath: host, changes: [{ ...modified("x", "x"), path: "../escape" }], git: null });
    expect(unsafe.status).toBe(400);
    const gitUnsafe = await t.json("POST", `/v1/sync/requests/${request.id}/plan`, { hostPath: host, changes: [], git: { changed: ["../config"], deleted: [] } });
    expect(gitUnsafe.status).toBe(400);
    await t.json("POST", `/v1/sync/requests/${request.id}/complete`, { status: "failed", error: "test" });
  });

  test("paths through a sandbox symlink are refused", async () => {
    const outside = makeTempDir("get-outside");
    symlinkSync(outside, sandbox("checked", "escape"));
    const request = await createGet("checked");
    const planned = await plan(request.id, { hostPath: host, changes: [added("escape/pwned.txt", "x")], git: null });
    expect(planned.status).toBe(400);
    expect(readdirSync(outside)).toEqual([]);
    await t.json("POST", `/v1/sync/requests/${request.id}/complete`, { status: "failed", error: "test" });
    rmSync(sandbox("checked", "escape"));
  });

  test("the archive must hold exactly the planned files with the planned content", async () => {
    writeFiles(host, { "a.txt": "new a\n" });
    const request = await createGet("checked");
    const planned = await plan(request.id, { hostPath: host, changes: [modified("a.txt", "something else\n")], git: null });
    expect(planned.response!.upload).toEqual(["a.txt"]);
    const wrong = await apply(request.id, tar(host, ["a.txt"]));
    expect(wrong.status).toBe(400);
    expect(JSON.stringify(wrong.body)).toContain("changed on the host during the sync");
    const missing = await apply(request.id, tar(host, []));
    expect(missing.status).toBe(400);
    expect(read("checked", "a.txt")).toBe("a\n");
    const stillClaimed = await t.json("POST", `/v1/sync/requests/${request.id}/complete`, { status: "failed", error: "bad archive" });
    expect(stillClaimed.status).toBe(200);
  });

  test("never-pushed projects cannot be got", async () => {
    mkdirSync(join(projects, "fresh"));
    const { status } = await t.json("POST", "/v1/projects/fresh/sync/requests", { kind: "get" });
    expect(status).toBe(400);
  });
});

describe("get: .git", () => {
  let host: string;

  beforeAll(async () => {
    host = makeTempDir("get-git-host");
    writeFiles(host, { "index.ts": "one\n" });
    git(host, "init", "-q");
    git(host, "add", ".");
    git(host, "commit", "-q", "-m", "first");
    await push("repo", host);
  });

  const gitPlan = () => ({ changed: gitFiles(host), deleted: [] });

  test("brings host commits: same HEAD, clean status", async () => {
    writeFiles(host, { "index.ts": "one\ntwo\n" });
    git(host, "commit", "-q", "-am", "second");
    const request = await get("repo", host, [modified("index.ts", "one\ntwo\n")], { git: gitPlan() });
    expect(request.status).toBe("applied");
    expect(request.result!.gitFiles).toBeGreaterThan(0);
    expect(git(join(projects, "repo"), "rev-parse", "HEAD")).toBe(git(host, "rev-parse", "HEAD"));
    expect(git(join(projects, "repo"), "status", "--porcelain")).toBe("");
  });

  test("git files deleted on the host are deleted in the sandbox", async () => {
    writeFiles(host, { ".git/refs/heads/topic": `${git(host, "rev-parse", "HEAD")}\n` });
    let request = await get("repo", host, [], { git: { changed: ["refs/heads/topic"], deleted: [] } });
    expect(existsSync(sandbox("repo", ".git/refs/heads/topic"))).toBe(true);
    rmSync(join(host, ".git/refs/heads/topic"));
    request = await get("repo", host, [], { git: { changed: [], deleted: ["refs/heads/topic"] } });
    expect(request.status).toBe("applied");
    expect(request.result!.gitFiles).toBe(1);
    expect(existsSync(sandbox("repo", ".git/refs/heads/topic"))).toBe(false);
  });

  test("sandbox commits since the last sync make .git a conflict", async () => {
    writeFiles(join(projects, "repo"), { "sandbox.ts": "s\n" });
    git(join(projects, "repo"), "add", "sandbox.ts");
    git(join(projects, "repo"), "commit", "-q", "-m", "sandbox work");
    writeFiles(host, { "index.ts": "one\ntwo\nthree\n" });
    git(host, "commit", "-q", "-am", "third");
    const request = await get("repo", host, [modified("index.ts", "one\ntwo\nthree\n")], { git: gitPlan() });
    expect(request.status).toBe("failed");
    expect(request.result!.conflicts).toEqual([".git"]);
    expect(request.error).toContain("new commits");
    expect(read("repo", "index.ts")).toBe("one\ntwo\n");

    const forced = await get("repo", host, [modified("index.ts", "one\ntwo\nthree\n")], { git: gitPlan(), force: true });
    expect(forced.status).toBe("applied");
    expect(git(join(projects, "repo"), "rev-parse", "HEAD")).toBe(git(host, "rev-parse", "HEAD"));
    expect(forced.result!.backupPath).toBeNull();
  });

  test("the baseline records the new HEAD, so the next get has no .git conflict", async () => {
    writeFiles(host, { "index.ts": "four\n" });
    git(host, "commit", "-q", "-am", "fourth");
    const request = await get("repo", host, [modified("index.ts", "four\n")], { git: gitPlan() });
    expect(request.status).toBe("applied");
    expect(lstatSync(sandbox("repo", ".git")).isDirectory()).toBe(true);
  });
});

describe("monolith --get (sandbox CLI)", () => {
  let host: string;
  let env: Record<string, string>;

  type Captured = Output & { stdout: string[]; stderr: string[] };
  const capture = (): Captured => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    return { stdout, stderr, out: (text) => stdout.push(text), err: (text) => stderr.push(text) };
  };

  beforeAll(async () => {
    host = makeTempDir("get-cli-host");
    writeFiles(host, { "src/a.ts": "a\nb\n" });
    await push("cli", host);
    env = { THEONE_WORKSPACE: t.workspace, THEONE_HOST: "127.0.0.1", THEONE_PORT: String(t.controller.url.port), THEONE_TOKEN: TEST_TOKEN };
  });

  const heartbeat = (projectIds: string[]) => t.json("POST", "/v1/sync/heartbeat", { host: HOST, projects: projectIds });

  /** The desktop companion: claims the next pending get and runs it. */
  async function serveOne(changes: SyncGetChange[]): Promise<void> {
    for (let attempt = 0; attempt < 200; attempt++) {
      const { body } = await t.json<SyncRequest[]>("GET", "/v1/sync/requests?status=pending");
      const pending = body.find((request) => request.kind === "get");
      if (pending) {
        await t.json("POST", `/v1/sync/requests/${pending.id}/claim`, { host: HOST });
        const planned = await plan(pending.id, { hostPath: host, changes, git: null });
        if (planned.response!.request.status === "failed") return;
        await apply(pending.id, tar(host, planned.response!.upload));
        return;
      }
      await Bun.sleep(10);
    }
    throw new Error("no get request showed up");
  }

  const run = (args: string[], cwd: string, output: Output, extra: { signal?: AbortSignal; syncPendingTimeoutMs?: number } = {}) =>
    runCli(["monolith", ...args], { env, output, cwd, syncPollMs: 10, ...extra });

  test("prints a git pull style summary, from any folder inside the project", async () => {
    await heartbeat(["cli"]);
    writeFiles(host, { "src/a.ts": "a\nB\nc\n" });
    const output = capture();
    const [code] = await Promise.all([run(["--get"], sandbox("cli", "src"), output), serveOne([modified("src/a.ts", "a\nB\nc\n")])]);
    expect(output.stderr.join("\n")).toContain("Waiting for Monolith on your computer");
    expect(code).toBe(0);
    const printed = output.stdout.join("\n").split("\n");
    expect(printed[0]).toBe(`From ${HOST}:${host}`);
    expect(printed[1]).toBe(" src/a.ts | 3 ++-");
    expect(printed[2]).toBe(" 1 file changed, 2 insertions(+), 1 deletion(-)");
    expect(printed.at(-1)).toMatch(/^Synced at \d{4}-\d\d-\d\d \d\d:\d\d:\d\d · previous sync \d{4}-\d\d-\d\d \d\d:\d\d:\d\d \(just now\)$/);
    expect(read("cli", "src/a.ts")).toBe("a\nB\nc\n");
  });

  test("already up to date", async () => {
    await heartbeat(["cli"]);
    const output = capture();
    const [code] = await Promise.all([run(["--get"], sandbox("cli", ""), output), serveOne([])]);
    expect(code).toBe(0);
    expect(output.stdout.join("\n")).toContain("Already up to date.");
  });

  test("conflicts exit 2 and list the files", async () => {
    await heartbeat(["cli"]);
    writeFiles(host, { "src/a.ts": "host\n" });
    writeFiles(join(projects, "cli"), { "src/a.ts": "sandbox\n" });
    const output = capture();
    const [code] = await Promise.all([run(["--get"], sandbox("cli", ""), output), serveOne([modified("src/a.ts", "host\n")])]);
    expect(code).toBe(2);
    expect(output.stderr.join("\n")).toContain("  src/a.ts");
    expect(output.stderr.join("\n")).toContain("monolith --get --force");
    expect(read("cli", "src/a.ts")).toBe("sandbox\n");
  });

  test("fails fast when the host is not linked or offline, outside a project, or for host-only flags", async () => {
    await heartbeat([]);
    let output = capture();
    expect(await run(["--get"], sandbox("cli", ""), output)).toBe(1);
    expect(output.stderr.join("\n")).toContain(`Monolith on ${HOST} has not linked cli`);

    output = capture();
    expect(await run(["--get"], t.workspace, output)).toBe(1);
    expect(output.stderr.join("\n")).toContain("inside a project folder");

    output = capture();
    expect(await run(["--sync"], sandbox("cli", ""), output)).toBe(2);
    expect(output.stderr.join("\n")).toContain("runs on your computer");

    output = capture();
    expect(await run([], sandbox("cli", ""), output)).toBe(2);
    expect(output.stdout.join("\n")).toContain("monolith --get [--force] [--json]");
  });

  test("a request nobody picks up is cancelled", async () => {
    await heartbeat(["cli"]);
    const output = capture();
    expect(await run(["--get"], sandbox("cli", ""), output, { syncPendingTimeoutMs: 50 })).toBe(1);
    expect(output.stderr.join("\n")).toContain("did not pick up the request");
    const { body } = await t.json<SyncRequest[]>("GET", "/v1/projects/cli/sync/requests");
    expect(body[0]!.status).toBe("cancelled");
  });

  test("Ctrl-C while waiting cancels the request", async () => {
    await heartbeat(["cli"]);
    const output = capture();
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);
    expect(await run(["--get"], sandbox("cli", ""), output, { signal: controller.signal })).toBe(130);
    expect(output.stderr.join("\n")).toContain("Cancelled; nothing was changed.");
    const { body } = await t.json<SyncRequest[]>("GET", "/v1/projects/cli/sync/requests");
    expect(body[0]!.status).toBe("cancelled");
  });
});

test("baseline keeps gotAt and gitHead across reads", () => {
  const baseline = JSON.parse(readFileSync(join(t.config.dataDir, "sync", "repo.json"), "utf8")) as { gotAt?: string; gitHead?: string };
  expect(baseline.gotAt).toBeString();
  expect(baseline.gitHead).toMatch(/^refs\/heads\/main@[0-9a-f]{40}$/);
});
