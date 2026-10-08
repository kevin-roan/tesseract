import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SyncGetChange, SyncRequest } from "@tesseract/protocol";
import type { SyncApi } from "./api";
import { GET_TEMP_PREFIX, GIT_DIR, MAX_GET_CHANGES, MAX_GET_GIT_PATHS, SYNC_STATE } from "./constants";
import { SyncBackError, isMissing } from "./errors";
import { isDirectory } from "./fsutil";
import { SYNC_LABELS } from "./labels";
import { DigestCache, buildManifest, resolvePath } from "./manifest";
import { requireLink } from "./pull";
import { iso, type Link, type SyncState } from "./state";
import { TarWriter } from "./tar";
import { collectFiles, contained, executables, scanTree, sorted, type GitManifest, type HostTree } from "./tree";

export interface GitPlan {
  changed: string[];
  deleted: string[];
}

export const GET_LIMITS = { maxChanges: MAX_GET_CHANGES, maxGitPaths: MAX_GET_GIT_PATHS };

const ARCHIVE_NAME = "get.tar.gz";

export function planChanges(tree: Pick<HostTree, "manifest" | "executable">, link: Link): SyncGetChange[] {
  const executable = new Set(tree.executable);
  const known = link.executable !== null ? new Set(link.executable) : null;
  const changes: SyncGetChange[] = [];
  for (const path of sorted(new Set([...Object.keys(tree.manifest), ...Object.keys(link.manifest)]))) {
    const digest = tree.manifest[path];
    const before = link.manifest[path];
    if (digest === undefined) {
      changes.push({ path, kind: "deleted", sha256: null, executable: false });
    } else if (before === undefined || before !== digest || (known !== null && known.has(path) !== executable.has(path))) {
      changes.push({ path, kind: before === undefined ? "added" : "modified", sha256: digest, executable: executable.has(path) });
    }
  }
  return changes;
}

export async function hostChangeList(link: Link, digests: DigestCache = new DigestCache()): Promise<SyncGetChange[]> {
  const root = await resolvePath(link.hostPath);
  if (!(await isDirectory(root))) return [];
  const manifest = await buildManifest(root, await contained(root, await collectFiles(root)), digests.hash);
  return planChanges({ manifest, executable: await executables(root, manifest, link.executable) }, link);
}

export async function hostChanges(link: Link, digests?: DigestCache): Promise<string[]> {
  return (await hostChangeList(link, digests)).map((change) => change.path);
}

export function planGit(current: GitManifest | null, previous: GitManifest | null): GitPlan | null {
  if (current === null) return null;
  const before = previous ?? {};
  return {
    changed: sorted(Object.entries(current).filter(([path, stamp]) => before[path] !== stamp).map(([path]) => path)),
    deleted: sorted(Object.keys(before).filter((path) => !(path in current))),
  };
}

function tooMany(what: string, root: string): SyncBackError {
  return new SyncBackError(SYNC_LABELS.tooMany(what, root));
}

function checkSubset(paths: string[], allowed: Set<string>, what: string): void {
  const unexpected = paths.find((path) => !allowed.has(path));
  if (unexpected !== undefined) throw new SyncBackError(SYNC_LABELS.unplanned(what, unexpected));
}

export async function writeGetArchive(
  root: string,
  upload: string[],
  gitUpload: string[],
  file: string,
  executable: readonly string[] = [],
): Promise<void> {
  const entries: [string, string][] = [
    ...upload.map((path): [string, string] => [join(root, path), path]),
    ...gitUpload.map((path): [string, string] => [join(root, GIT_DIR, path), `${GIT_DIR}/${path}`]),
  ];
  const writer = new TarWriter(file, new Set(executable));
  try {
    for (const [source, name] of entries) {
      try {
        await writer.addPath(source, name);
      } catch (error) {
        if (isMissing(error)) throw new SyncBackError(SYNC_LABELS.vanished(name), { cause: error });
        throw error;
      }
    }
    await writer.close();
  } catch (error) {
    await writer.abort();
    throw error;
  }
}

export async function runGet(api: SyncApi, state: SyncState, request: SyncRequest): Promise<SyncRequest> {
  const projectId = request.projectId;
  const link = await requireLink(state, projectId);
  const root = await resolvePath(link.hostPath);
  return state.projectLock(projectId, async () => {
    const tree = await scanTree(root, await collectFiles(root), undefined, link.executable);
    const changes = planChanges(tree, link);
    if (changes.length > GET_LIMITS.maxChanges) throw tooMany(SYNC_LABELS.tooManyFiles, root);
    const git = planGit(tree.git, link.gitManifest);
    if (git && Math.max(git.changed.length, git.deleted.length) > GET_LIMITS.maxGitPaths) {
      throw tooMany(SYNC_LABELS.tooManyGitFiles, root);
    }
    const hostPath = link.confidential ? SYNC_STATE.redacted : root;
    const planned = await api.planGet(request.id, { hostPath, changes, git });
    if (planned.request.status === "failed") return planned.request;
    const sendable = new Set(changes.filter((change) => change.kind !== "deleted").map((change) => change.path));
    checkSubset(planned.upload ?? [], sendable, SYNC_LABELS.unplannedFile);
    checkSubset(planned.gitUpload ?? [], new Set(git ? git.changed : []), SYNC_LABELS.unplannedGitFile);
    const temp = await mkdtemp(join(tmpdir(), GET_TEMP_PREFIX));
    let done: SyncRequest;
    try {
      const archive = join(temp, ARCHIVE_NAME);
      await writeGetArchive(root, planned.upload ?? [], planned.gitUpload ?? [], archive, tree.executable);
      done = await api.applyGet(request.id, archive);
    } finally {
      await rm(temp, { recursive: true, force: true }).catch(() => undefined);
    }
    if (done.status === "applied") {
      const gotAt = done.result?.syncedAt || iso(new Date());
      await state.recordGet(projectId, tree.manifest, tree.executable, tree.git, gotAt);
    } else if (done.status !== "failed") {
      throw new SyncBackError(SYNC_LABELS.getLeft(done.status));
    }
    return done;
  });
}
