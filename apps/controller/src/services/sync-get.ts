import { constants } from "node:fs";
import { chmod, copyFile, cp, lstat, mkdir, readdir, readFile, readlink, rename, rm, rmdir, stat, symlink, writeFile } from "node:fs/promises";
import { dirname, join, posix } from "node:path";
import { badRequest } from "../core/errors";
import { childEnv } from "../core/exec";
import { countLineChanges, isBinary, splitLines } from "../core/line-diff";
import { realpathOrNull } from "../core/paths";
import type { SyncFileMode, SyncFileStat, SyncGetChange, SyncGetPlan } from "@theone/protocol";

export const GIT_DIR = ".git";
/** Conflict entry for a sandbox repository whose HEAD moved since the last sync. */
export const GIT_CONFLICT = ".git";
/** Larger files get sizes instead of line counts, like binaries. */
const MAX_DIFF_BYTES = 16 * 1024 * 1024;
const KEEP_BACKUPS = 20;

export type Probe = { type: "file" | "symlink"; sha256: string; size: number; executable: boolean; mode: number } | { type: "other" } | null;

export const sha256Text = (value: string) => new Bun.CryptoHasher("sha256").update(value).digest("hex");

export async function sha256File(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  for await (const chunk of Bun.file(path).stream()) hasher.update(chunk);
  return hasher.digest("hex");
}

const isMissing = (error: unknown) => ["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "");

async function lstatOrNull(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

/** What is at `path` without following a symlink there; `null` when absent. */
export async function probe(path: string): Promise<Probe> {
  const stats = await lstatOrNull(path);
  if (!stats) return null;
  if (stats.isSymbolicLink()) {
    const target = await readlink(path);
    return { type: "symlink", sha256: sha256Text(target), size: Buffer.byteLength(target), executable: false, mode: 0o777 };
  }
  if (!stats.isFile()) return { type: "other" };
  return { type: "file", sha256: await sha256File(path), size: stats.size, executable: (stats.mode & 0o111) !== 0, mode: stats.mode & 0o7777 };
}

/** The hash a conflict check compares: `null` when absent, a marker for directories and other non-files. */
export const probeHash = (entry: Probe): string | null => (entry === null ? null : entry.type === "other" ? "<not a file>" : entry.sha256);

export async function probeAll(root: string, changes: readonly SyncGetChange[]): Promise<Map<string, Probe>> {
  const entries = new Map<string, Probe>();
  for (const change of changes) entries.set(change.path, await probe(join(root, change.path)));
  return entries;
}

/** The deepest existing ancestor of `root/rel` is a real directory under `root`, reached without symlinks. */
export async function parentIsSafe(root: string, rel: string): Promise<boolean> {
  let dir = dirname(join(root, rel));
  while (dir !== root) {
    const stats = await lstatOrNull(dir);
    if (stats) return stats.isDirectory() && realpathOrNull(dir) === dir;
    dir = dirname(dir);
  }
  return true;
}

/** Duplicate paths, a hash on a delete or none on an add/modify, and paths behind sandbox symlinks are refused. */
export async function checkPlan(root: string, plan: SyncGetPlan): Promise<void> {
  const seen = new Set<string>();
  for (const change of plan.changes) {
    if (seen.has(change.path)) throw badRequest(`${change.path} is listed twice`);
    seen.add(change.path);
    if ((change.kind === "deleted") !== (change.sha256 === null)) throw badRequest(`${change.path}: sha256 must be null exactly for a delete`);
    if (!(await parentIsSafe(root, change.path))) throw badRequest(`${change.path}: a folder on its way in the sandbox is a symlink or a file`);
  }
  if (!plan.git) return;
  const gitDir = await lstatOrNull(join(root, GIT_DIR));
  if (gitDir && (!gitDir.isDirectory() || realpathOrNull(join(root, GIT_DIR)) !== join(root, GIT_DIR))) {
    throw badRequest("The sandbox .git is not a directory");
  }
  for (const path of [...plan.git.changed, ...plan.git.deleted]) {
    if (!(await parentIsSafe(root, `${GIT_DIR}/${path}`))) throw badRequest(`.git/${path}: a folder on its way in the sandbox is a symlink or a file`);
  }
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<void> {
  const reader = stream.getReader();
  while (!(await reader.read()).done);
}

/** Extracts exactly `members` (tar fails on a missing one) into `dir`; nothing else in the archive is written. */
export async function extractMembers(archive: ReadableStream<Uint8Array>, gzip: boolean, dir: string, members: readonly string[]): Promise<void> {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  if (members.length === 0) return drain(archive);
  const list = `${dir}.members`;
  await writeFile(list, members.map((member) => `${member}\0`).join(""), { mode: 0o600 });
  const tar = Bun.spawn(
    ["tar", "-x", ...(gzip ? ["-z"] : []), "-f", "-", "-C", dir, "--no-same-owner", "--no-same-permissions", "--null", "--verbatim-files-from", "-T", list],
    { env: childEnv(), stdin: "pipe", stdout: "ignore", stderr: "pipe" },
  );
  try {
    for await (const chunk of archive) {
      tar.stdin.write(chunk);
      await tar.stdin.flush();
    }
  } catch (error) {
    tar.kill("SIGKILL");
    throw error;
  } finally {
    try {
      await tar.stdin.end();
    } catch {}
  }
  const [stderr, code] = await Promise.all([new Response(tar.stderr).text(), tar.exited]);
  await rm(list, { force: true });
  if (code !== 0) throw badRequest(`Could not extract the archive: ${stderr.trim().split("\n").at(-1) || `tar exited with ${code}`}`);
}

/** Every staged member is a regular file or (outside .git) an in-tree symlink, and planned hashes match. */
export async function checkStaged(dir: string, expected: ReadonlyMap<string, string | null>): Promise<void> {
  const root = realpathOrNull(dir) ?? dir;
  for (const [member, sha256] of expected) {
    const full = join(root, member);
    if (realpathOrNull(dirname(full)) !== dirname(full)) throw badRequest(`Refusing ${member}: it goes through a symlink in the archive`);
    const entry = await probe(full);
    if (entry === null) throw badRequest(`The archive is missing ${member}`);
    if (entry.type === "other") throw badRequest(`Refusing ${member}: only regular files and symlinks can be synced`);
    if (entry.type === "symlink") {
      const target = await readlink(full);
      const resolved = posix.normalize(posix.join(posix.dirname(member), target));
      if (member.startsWith(`${GIT_DIR}/`) || posix.isAbsolute(target) || resolved === ".." || resolved.startsWith("../")) {
        throw badRequest(`Refusing symlink ${member} -> ${target}: it points outside the project`);
      }
    }
    if (sha256 !== null && entry.sha256 !== sha256) throw badRequest(`${member} changed on the host during the sync; run monolith --get again`);
  }
}

async function move(from: string, to: string): Promise<void> {
  try {
    await rename(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
    await cp(from, to, { verbatimSymlinks: true, preserveTimestamps: true });
    await rm(from, { force: true });
  }
}

const withExecutable = (mode: number, executable: boolean) =>
  executable ? (mode & 0o111 ? mode : mode | ((mode & 0o444) >> 2)) : mode & ~0o111;

const gitMode = (entry: Probe): SyncFileMode | null =>
  entry === null || entry.type === "other" ? null : entry.type === "symlink" ? "120000" : entry.executable ? "100755" : "100644";

async function content(path: string, entry: Probe): Promise<Uint8Array | null> {
  if (entry === null || entry.type === "other") return new Uint8Array();
  if (entry.type === "symlink") return new TextEncoder().encode(await readlink(path));
  if (entry.size > MAX_DIFF_BYTES) return null;
  return new Uint8Array(await readFile(path));
}

async function fileStat(path: string, kind: SyncFileStat["kind"], before: { path: string; entry: Probe }, after: { path: string; entry: Probe }): Promise<SyncFileStat> {
  const sizes = { oldSize: before.entry && before.entry.type !== "other" ? before.entry.size : null, newSize: after.entry && after.entry.type !== "other" ? after.entry.size : null };
  const modes = { oldMode: gitMode(before.entry), newMode: gitMode(after.entry) };
  const sameContent = before.entry?.type !== "other" && after.entry?.type !== "other" && before.entry?.sha256 === after.entry?.sha256;
  if (sameContent) return { path, kind, insertions: 0, deletions: 0, binary: false, ...modes, ...sizes };
  const [old, next] = await Promise.all([content(before.path, before.entry), content(after.path, after.entry)]);
  if (old === null || next === null || isBinary(old) || isBinary(next)) return { path, kind, insertions: 0, deletions: 0, binary: true, ...modes, ...sizes };
  return { path, kind, ...countLineChanges(splitLines(old), splitLines(next)), binary: false, ...modes, ...sizes };
}

type Step = { change: SyncGetChange; kind: SyncFileStat["kind"]; entry: Probe; staged: string | null; incoming: Probe };

export type GetApplyInput = {
  root: string;
  staged: string;
  work: string;
  plan: SyncGetPlan;
  current: ReadonlyMap<string, Probe>;
  upload: ReadonlySet<string>;
  gitUpload: readonly string[];
  overwritten: readonly string[];
  backupDir: string;
};

export type GetApplyOutcome = { files: SyncFileStat[]; gitFiles: number; backupPath: string | null };

async function plannedSteps(input: GetApplyInput): Promise<Step[]> {
  const steps: Step[] = [];
  for (const change of input.plan.changes) {
    const entry = input.current.get(change.path) ?? null;
    if (entry?.type === "other") throw badRequest(`${change.path} is a folder or special file in the sandbox`);
    if (change.sha256 === null) {
      if (entry) steps.push({ change, kind: "deleted", entry, staged: null, incoming: null });
      continue;
    }
    if (entry?.sha256 === change.sha256) {
      if (entry.type === "file" && entry.executable !== change.executable) {
        const incoming = { ...entry, executable: change.executable, mode: withExecutable(entry.mode, change.executable) };
        steps.push({ change, kind: "modified", entry, staged: null, incoming });
      }
      continue;
    }
    if (!input.upload.has(change.path)) throw badRequest(`${change.path} changed in the sandbox during the sync; run monolith --get again`);
    const staged = join(input.staged, change.path);
    const incoming = await probe(staged);
    if (incoming?.type === "file") incoming.executable = change.executable;
    steps.push({ change, kind: entry ? "modified" : "added", entry, staged, incoming });
  }
  return steps;
}

/** Copies the sandbox versions of `paths` into `backupDir` (keeping the newest backups of the project); `null` when there was nothing to copy. */
async function backup(root: string, paths: readonly string[], current: ReadonlyMap<string, Probe>, backupDir: string): Promise<string | null> {
  let copied = false;
  for (const path of paths) {
    const entry = current.get(path) ?? null;
    if (!entry || entry.type === "other") continue;
    const target = join(backupDir, path);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await cp(join(root, path), target, { verbatimSymlinks: true, preserveTimestamps: true });
    copied = true;
  }
  if (!copied) return null;
  await pruneBackups(dirname(backupDir));
  return backupDir;
}

async function pruneBackups(dir: string): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const dated = await Promise.all(
    entries.filter((entry) => entry.isDirectory()).map(async (entry) => ({ path: join(dir, entry.name), mtime: (await stat(join(dir, entry.name))).mtimeMs })),
  );
  for (const old of dated.sort((a, b) => b.mtime - a.mtime).slice(KEEP_BACKUPS)) await rm(old.path, { recursive: true, force: true });
}

/** Moves files into place; every step can be undone, in reverse, if a later one fails. */
class Transaction {
  private readonly undo: (() => Promise<void>)[] = [];
  private saved = 0;

  constructor(private readonly work: string) {}

  async remove(root: string, target: string): Promise<boolean> {
    if (!(await lstatOrNull(target))) return false;
    await this.save(target);
    await pruneEmptyParents(root, target);
    return true;
  }

  async place(root: string, source: string, target: string, mode: number | null): Promise<void> {
    await this.makeParents(root, target);
    if (await lstatOrNull(target)) await this.save(target);
    await move(source, target);
    this.undo.push(() => rm(target, { force: true }));
    if (mode !== null) await chmod(target, mode);
  }

  async chmod(target: string, from: number, to: number): Promise<void> {
    await chmod(target, to);
    this.undo.push(() => chmod(target, from));
  }

  async rollback(): Promise<string[]> {
    const problems: string[] = [];
    for (const step of this.undo.reverse()) {
      try {
        await step();
      } catch (error) {
        problems.push(error instanceof Error ? error.message : String(error));
      }
    }
    return problems;
  }

  private async save(target: string): Promise<void> {
    const copy = join(this.work, String(this.saved++));
    await move(target, copy);
    this.undo.push(async () => {
      await mkdir(dirname(target), { recursive: true });
      await move(copy, target);
    });
  }

  private async makeParents(root: string, target: string): Promise<void> {
    const missing: string[] = [];
    for (let dir = dirname(target); dir !== root && !(await lstatOrNull(dir)); dir = dirname(dir)) missing.push(dir);
    for (const dir of missing.reverse()) {
      await mkdir(dir);
      this.undo.push(() => rmdir(dir));
    }
  }
}

async function pruneEmptyParents(root: string, target: string): Promise<void> {
  for (let dir = dirname(target); dir !== root && dir.startsWith(`${root}/`); dir = dirname(dir)) {
    try {
      await rmdir(dir);
    } catch {
      return;
    }
  }
}

/** Applies a planned `get` to the project at `root`: working tree, then `.git`; all or nothing. */
export async function applyGet(input: GetApplyInput): Promise<GetApplyOutcome> {
  const steps = await plannedSteps(input);
  const files: SyncFileStat[] = [];
  for (const step of steps) {
    const before = { path: join(input.root, step.change.path), entry: step.entry };
    files.push(await fileStat(step.change.path, step.kind, before, { path: step.staged ?? before.path, entry: step.incoming }));
  }
  const backupPath = await backup(input.root, input.overwritten, input.current, input.backupDir);
  await mkdir(input.work, { recursive: true, mode: 0o700 });
  const transaction = new Transaction(input.work);
  let gitFiles = 0;
  try {
    for (const step of steps.filter((s) => s.kind === "deleted")) await transaction.remove(input.root, join(input.root, step.change.path));
    for (const step of steps.filter((s) => s.kind !== "deleted")) {
      const target = join(input.root, step.change.path);
      const incoming = step.incoming;
      const mode = incoming?.type === "file" ? withExecutable(step.entry?.type === "file" ? step.entry.mode : incoming.mode, step.change.executable) : null;
      if (step.staged === null) await transaction.chmod(target, step.entry?.type === "file" ? step.entry.mode : 0o644, mode ?? 0o644);
      else await transaction.place(input.root, step.staged, target, mode);
    }
    if (input.plan.git) {
      const gitRoot = join(input.root, GIT_DIR);
      for (const path of input.plan.git.deleted) {
        const target = join(gitRoot, path);
        if ((await lstatOrNull(target))?.isFile() && (await transaction.remove(gitRoot, target))) gitFiles++;
      }
      for (const path of input.gitUpload) {
        await transaction.place(input.root, join(input.staged, GIT_DIR, path), join(gitRoot, path), null);
        gitFiles++;
      }
    }
  } catch (error) {
    const problems = await transaction.rollback();
    const reason = error instanceof Error ? error.message : String(error);
    if (problems.length > 0) throw new Error(`Get failed (${reason}) and the rollback was incomplete: ${problems.slice(0, 5).join("; ")}`);
    throw new Error(`Get failed, nothing was changed: ${reason}`);
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { files, gitFiles, backupPath };
}

/** `restore: null` removes the file (an `added` change); `blob` is a stored baseline file or symlink target; `executable: null` keeps the current bit. */
export type DiscardStep = {
  path: string;
  restore: { kind: "file" | "symlink"; blob: string; executable: boolean | null } | { kind: "mode"; executable: boolean } | null;
};

export type DiscardInput = { root: string; work: string; steps: readonly DiscardStep[]; backupDir: string };

/** Puts sandbox files back to their baseline versions, after backing up what is there; all or nothing. */
export async function applyDiscard(input: DiscardInput): Promise<{ backupPath: string | null }> {
  const current = new Map<string, Probe>();
  for (const step of input.steps) {
    if (!(await parentIsSafe(input.root, step.path))) throw badRequest(`${step.path}: a folder on its way in the sandbox is a symlink or a file`);
    const entry = await probe(join(input.root, step.path));
    if (entry?.type === "other") throw badRequest(`${step.path} is a folder or special file in the sandbox`);
    current.set(step.path, entry);
  }
  const backupPath = await backup(input.root, [...current.keys()], current, input.backupDir);
  const staging = join(input.work, "in");
  await mkdir(staging, { recursive: true, mode: 0o700 });
  await mkdir(join(input.work, "rollback"), { recursive: true, mode: 0o700 });
  const transaction = new Transaction(join(input.work, "rollback"));
  try {
    for (const [index, step] of input.steps.entries()) {
      const target = join(input.root, step.path);
      const entry = current.get(step.path) ?? null;
      const mode = entry?.type === "file" ? entry.mode : 0o644;
      const restore = step.restore;
      if (restore === null) {
        await transaction.remove(input.root, target);
      } else if (restore.kind === "mode") {
        await transaction.chmod(target, mode, withExecutable(mode, restore.executable));
      } else if (restore.kind === "symlink") {
        const staged = join(staging, String(index));
        await symlink(await readFile(restore.blob, "utf8"), staged);
        await transaction.place(input.root, staged, target, null);
      } else {
        const staged = join(staging, String(index));
        await copyFile(restore.blob, staged, constants.COPYFILE_FICLONE);
        const executable = restore.executable ?? (entry?.type === "file" && entry.executable);
        await transaction.place(input.root, staged, target, withExecutable(mode, executable));
      }
    }
  } catch (error) {
    const problems = await transaction.rollback();
    const reason = error instanceof Error ? error.message : String(error);
    if (problems.length > 0) throw new Error(`Discard failed (${reason}) and the rollback was incomplete: ${problems.slice(0, 5).join("; ")}`);
    throw new Error(`Discard failed, nothing was changed: ${reason}`);
  }
  return { backupPath };
}
