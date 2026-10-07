import { createWriteStream } from "node:fs";
import { chmod, lstat, mkdir, mkdtemp, readlink, rm, rmdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { SyncAck, SyncFileChange } from "@theone/protocol";
import { createLogger } from "../log";
import type { ByteStream, SyncApi } from "./api";
import { ACCESS_BITS, CHANGE_KINDS, CONFLICT_PREVIEW, PULL_TEMP_PREFIX, STAGED_MIN_MODE } from "./constants";
import { NotLinked, SyncBackError, SyncConflict, errorMessage } from "./errors";
import {
  IS_WINDOWS,
  copyForSnapshot,
  fileMode,
  install,
  isDirectory,
  isExecutable,
  lexists,
  makeParents,
  pruneEmptyParents,
  remove,
  withExecutable,
} from "./fsutil";
import { SYNC_LABELS } from "./labels";
import { checkRelative, hashPath, isWithin, linkLeaves, nestedUnder, resolveInside, resolvePath } from "./manifest";
import { savedCopy, type Link, type Snapshot, type SnapshotEntry, type SyncState } from "./state";
import { TarFormatError, fileSource, readTar } from "./tar";
import { sorted } from "./tree";

export type ChangeKind = (typeof CHANGE_KINDS)[number];

export interface PullOutcome {
  projectId: string;
  hostPath: string;
  added: string[];
  modified: string[];
  deleted: string[];
  conflicts: string[];
  snapshotId: string | null;
  dryRun: boolean;
  warnings: string[];
}

export interface SyncResultBody {
  added: number;
  modified: number;
  deleted: number;
  conflicts: string[];
  snapshotId: string | null;
  hostPath: string | null;
}

type Change = Pick<SyncFileChange, "path" | "sha256"> & { kind: string };

const log = createLogger("syncback");
const ARCHIVE_NAME = "export.tar";
const STAGED_DIR = "staged";
const PARENT = "..";

export function pullTotal(outcome: PullOutcome): number {
  return outcome.added.length + outcome.modified.length + outcome.deleted.length;
}

export function pullResult(outcome: PullOutcome): SyncResultBody {
  return {
    added: outcome.added.length,
    modified: outcome.modified.length,
    deleted: outcome.deleted.length,
    conflicts: [...outcome.conflicts],
    snapshotId: outcome.snapshotId,
    hostPath: outcome.hostPath,
  };
}

export async function requireLink(state: SyncState, projectId: string): Promise<Link> {
  const link = await state.link(projectId);
  if (!link) throw new NotLinked(projectId);
  if (!(await isDirectory(link.hostPath))) throw new SyncBackError(SYNC_LABELS.hostMissing(link.hostPath));
  return link;
}

export async function isConflict(target: string, expected: string | null, incoming: string | null): Promise<boolean> {
  const current = await hashPath(target);
  return current !== expected && current !== incoming;
}

export interface PullOptions {
  paths?: string[] | null;
  force?: boolean;
  dryRun?: boolean;
}

export async function pull(api: SyncApi, state: SyncState, projectId: string, options: PullOptions = {}): Promise<PullOutcome> {
  const link = await requireLink(state, projectId);
  const root = await resolvePath(link.hostPath);
  return state.projectLock(projectId, async () => {
    const data = await api.syncChanges(projectId);
    if (data.baselineAt == null) throw new SyncBackError(SYNC_LABELS.neverPushed(projectId));
    let changes: Change[] = [...(data.changes ?? [])];
    if (options.paths) {
      const wanted = new Set(options.paths);
      changes = changes.filter((change) => wanted.has(change.path));
    }
    const outcome: PullOutcome = {
      projectId,
      hostPath: root,
      added: [],
      modified: [],
      deleted: [],
      conflicts: [],
      snapshotId: null,
      dryRun: options.dryRun ?? false,
      warnings: [],
    };
    const targets = new Map<string, string>();
    for (const change of changes) targets.set(change.path, await resolveInside(root, change.path));
    for (const change of changes) {
      if (!(CHANGE_KINDS as readonly string[]).includes(change.kind)) {
        throw new SyncBackError(SYNC_LABELS.unknownKind(change.kind, change.path));
      }
      outcome[change.kind as ChangeKind].push(change.path);
      if (await isConflict(targets.get(change.path) as string, link.manifest[change.path] ?? null, change.sha256 ?? null)) {
        outcome.conflicts.push(change.path);
      }
    }
    if (!changes.length || options.dryRun) return outcome;
    if (outcome.conflicts.length && !options.force) throw new SyncConflict(outcome.conflicts);
    const { written, executable } = await applyChanges(api, state, link, root, changes, targets, outcome);
    await state.updateManifest(projectId, written, executable);
    try {
      await api.syncAck(projectId, Object.entries(written).map(([path, digest]) => ack(path, digest, executable[path])));
    } catch (error) {
      log.warn(`sync ack failed: ${errorMessage(error)}`);
      outcome.warnings.push(SYNC_LABELS.ackFailed(errorMessage(error)));
    }
    await state.prune(projectId);
    return outcome;
  });
}

function ack(path: string, digest: string | null, executable: boolean | undefined): SyncAck["changes"][number] {
  const change: SyncAck["changes"][number] = { path, sha256: digest };
  if (digest !== null && executable !== undefined && !IS_WINDOWS) change.executable = executable;
  return change;
}

async function applyChanges(
  api: SyncApi,
  state: SyncState,
  link: Link,
  root: string,
  changes: Change[],
  targets: Map<string, string>,
  outcome: PullOutcome,
): Promise<{ written: Record<string, string | null>; executable: Record<string, boolean> }> {
  const incoming = changes.filter((change) => change.kind !== "deleted").map((change) => change.path);
  const deletes = changes.filter((change) => change.kind === "deleted").map((change) => change.path);
  const temp = await mkdtemp(join(tmpdir(), PULL_TEMP_PREFIX));
  try {
    const staged = incoming.length ? await stageExport(await api.syncExport(link.projectId, incoming), new Set(incoming), temp) : new Map<string, string>();
    const written: Record<string, string | null> = {};
    const executable: Record<string, boolean> = {};
    for (const path of incoming) written[path] = await hashPath(staged.get(path) as string);
    for (const path of deletes) written[path] = null;
    if (!IS_WINDOWS) for (const path of incoming) executable[path] = await isExecutable(staged.get(path) as string);
    const snapshot = await takeSnapshot(state, link.projectId, root, targets, written, link.manifest);
    outcome.snapshotId = snapshot.id;
    const created: string[] = [];
    try {
      for (const path of deletes) {
        const target = await resolveInside(root, path);
        await remove(target);
        await pruneEmptyParents(root, target);
      }
      for (const path of incoming) {
        const target = await resolveInside(root, path);
        const source = staged.get(path) as string;
        await checkLinkTarget(root, target, source, path);
        await makeParents(root, target, created);
        const hostMode = await fileMode(target);
        await install(source, target, hostMode === null ? undefined : withExecutable(hostMode, executable[path] ?? false));
      }
    } catch (error) {
      await rollback(state, root, snapshot, created, error);
    }
    return { written, executable };
  } finally {
    await rm(temp, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function takeSnapshot(
  state: SyncState,
  projectId: string,
  root: string,
  targets: Map<string, string>,
  after: Record<string, string | null>,
  manifest: Record<string, string>,
): Promise<Snapshot> {
  const entries: SnapshotEntry[] = [];
  for (const [path, digest] of Object.entries(after)) {
    entries.push({
      path,
      before: (await lexists(targets.get(path) as string)) ? "file" : "absent",
      after_sha256: digest,
      manifest_before: manifest[path] ?? null,
      baseline_known: true,
    });
  }
  const snapshot = await state.newSnapshot(projectId, root, entries);
  try {
    for (const entry of entries) {
      if (entry.before === "file") await copyForSnapshot(targets.get(entry.path) as string, savedCopy(snapshot, entry.path));
    }
    await state.saveSnapshot(snapshot);
  } catch (error) {
    await state.discardSnapshot(snapshot);
    throw new SyncBackError(SYNC_LABELS.snapshotFailed(errorMessage(error)), { cause: error });
  }
  return snapshot;
}

async function checkLinkTarget(root: string, target: string, source: string, path: string): Promise<void> {
  if (!(await lstat(source)).isSymbolicLink()) return;
  const text = await readlink(source);
  if (await linkLeaves(root, target, text)) throw new SyncBackError(SYNC_LABELS.symlinkOutside(path, text));
}

async function rollback(
  state: SyncState,
  root: string,
  snapshot: Snapshot,
  created: string[],
  cause: unknown,
): Promise<never> {
  const problems: string[] = [];
  for (const entry of snapshot.entries) {
    if (entry.before !== "absent") continue;
    try {
      await remove(await resolveInside(root, entry.path));
    } catch (error) {
      problems.push(`${entry.path}: ${errorMessage(error)}`);
    }
  }
  for (const directory of [...created].reverse()) await rmdir(directory).catch(() => undefined);
  for (const entry of snapshot.entries) {
    if (entry.before !== "file") continue;
    try {
      const target = await resolveInside(root, entry.path);
      await makeParents(root, target, []);
      await install(savedCopy(snapshot, entry.path), target);
    } catch (error) {
      problems.push(`${entry.path}: ${errorMessage(error)}`);
    }
  }
  if (problems.length) {
    throw new SyncBackError(SYNC_LABELS.rollbackIncomplete(errorMessage(cause), problems.join("; "), snapshot.directory), { cause });
  }
  await state.discardSnapshot(snapshot);
  throw new SyncBackError(SYNC_LABELS.rollbackDone(errorMessage(cause)), { cause });
}

export function memberName(name: string, isDirectory: boolean): string {
  let result = name;
  while (result.startsWith("./")) result = result.slice(2);
  return isDirectory ? result.replace(/\/+$/, "") : result;
}

export async function saveStream(source: ByteStream, file: string): Promise<void> {
  await pipeline(Readable.from(source as AsyncIterable<Uint8Array>), createWriteStream(file));
}

export async function stageExport(source: ByteStream, wanted: Set<string>, temp: string): Promise<Map<string, string>> {
  const archive = join(temp, ARCHIVE_NAME);
  await saveStream(source, archive);
  return extractExport(archive, wanted, join(temp, STAGED_DIR));
}

function escapesProject(name: string, link: string): boolean {
  const resolved = posix.normalize(posix.join(posix.dirname(name), link));
  return !link || posix.isAbsolute(link) || resolved === PARENT || resolved.startsWith(`${PARENT}/`);
}

async function stagedParent(dest: string, target: string, name: string): Promise<void> {
  await mkdir(dirname(target), { recursive: true });
  if (!isWithin(await resolvePath(dest), await resolvePath(dirname(target)))) {
    throw new SyncBackError(SYNC_LABELS.leavesRoot(name, dest));
  }
}

async function checkStagedLinks(dest: string, staged: Map<string, string>): Promise<void> {
  for (const [name, target] of staged) {
    if (!(await lstat(target)).isSymbolicLink()) continue;
    const text = await readlink(target);
    if (await linkLeaves(dest, target, text)) throw new SyncBackError(SYNC_LABELS.symlinkOutside(name, text));
  }
}

export async function extractExport(archive: string, wanted: Set<string>, dest: string): Promise<Map<string, string>> {
  const staged = new Map<string, string>();
  await mkdir(dest, { recursive: true });
  const root = await resolvePath(dest);
  try {
    await readTar(fileSource(archive), async (member, body) => {
      const name = memberName(member.name, member.isDirectory);
      if (member.isDirectory) {
        if (name) checkRelative(name);
        return;
      }
      checkRelative(name);
      if (!wanted.has(name)) throw new SyncBackError(SYNC_LABELS.unexpectedFile(name));
      if (staged.has(name)) throw new SyncBackError(SYNC_LABELS.duplicateFile(name));
      const parent = nestedUnder(name, wanted);
      if (parent !== null) throw new SyncBackError(SYNC_LABELS.nestedPath(name, parent));
      const target = join(root, name);
      await stagedParent(root, target, name);
      if (member.isSymlink) {
        if (escapesProject(name, member.linkname)) throw new SyncBackError(SYNC_LABELS.symlinkOutside(name, member.linkname));
        await symlink(member.linkname, target);
      } else if (member.isRegular) {
        try {
          await pipeline(Readable.from(body), createWriteStream(target));
        } catch (error) {
          if (error instanceof TarFormatError) throw error;
          throw new SyncBackError(SYNC_LABELS.memberUnreadable(name), { cause: error });
        }
        await chmod(target, (member.mode & ACCESS_BITS) | STAGED_MIN_MODE);
      } else {
        throw new SyncBackError(SYNC_LABELS.memberType(name));
      }
      staged.set(name, target);
    });
  } catch (error) {
    if (error instanceof SyncBackError) throw error;
    if (error instanceof TarFormatError || isZlibError(error)) {
      throw new SyncBackError(SYNC_LABELS.unreadableArchive(errorMessage(error)), { cause: error });
    }
    throw error;
  }
  const missing = sorted([...wanted].filter((path) => !staged.has(path)));
  if (missing.length) throw new SyncBackError(SYNC_LABELS.archiveMissing(missing.slice(0, CONFLICT_PREVIEW).join(", ")));
  await checkStagedLinks(root, staged);
  return staged;
}

function isZlibError(error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
  return code.startsWith("Z_");
}
