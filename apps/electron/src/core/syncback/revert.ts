import type { SyncAck } from "@tesseract/protocol";
import { createLogger } from "../log";
import type { SyncApi } from "./api";
import { SyncBackError, SyncConflict, errorMessage } from "./errors";
import { IS_WINDOWS, copyForSnapshot, install, isDirectory, isExecutable, lexists, makeParents, pruneEmptyParents, remove } from "./fsutil";
import { SYNC_LABELS } from "./labels";
import { hashPath, resolveInside, resolvePath } from "./manifest";
import type { SyncResultBody } from "./pull";
import { displacedCopy, savedCopy, type SyncState } from "./state";

export type BaselineChange = SyncAck["changes"][number];

export interface RevertOutcome {
  projectId: string;
  hostPath: string;
  snapshotId: string;
  restored: string[];
  recreated: string[];
  removed: string[];
  conflicts: string[];
  displaced: string[];
  displacedDir: string | null;
  baseline: BaselineChange[];
  warnings: string[];
}

const log = createLogger("syncback");

export function revertResult(outcome: RevertOutcome): SyncResultBody {
  return {
    added: outcome.recreated.length,
    modified: outcome.restored.length,
    deleted: outcome.removed.length,
    conflicts: [...outcome.conflicts],
    snapshotId: outcome.snapshotId,
    hostPath: outcome.hostPath,
  };
}

export function revert(state: SyncState, projectId: string, force = false): Promise<RevertOutcome> {
  return state.projectLock(projectId, async () => {
    const snapshot = (await state.snapshots(projectId)).find((candidate) => !candidate.reverted);
    if (!snapshot) throw new SyncBackError(SYNC_LABELS.nothingToRevert(projectId));
    const root = await resolvePath(snapshot.hostPath);
    if (!(await isDirectory(root))) throw new SyncBackError(SYNC_LABELS.revertRootMissing(root));
    const targets = new Map<string, string>();
    for (const entry of snapshot.entries) targets.set(entry.path, await resolveInside(root, entry.path));
    const target = (path: string) => targets.get(path) as string;
    const outcome: RevertOutcome = {
      projectId,
      hostPath: root,
      snapshotId: snapshot.id,
      restored: [],
      recreated: [],
      removed: [],
      conflicts: [],
      displaced: [],
      displacedDir: null,
      baseline: [],
      warnings: [],
    };
    for (const entry of snapshot.entries) {
      if ((await hashPath(target(entry.path))) !== entry.after_sha256) outcome.conflicts.push(entry.path);
    }
    if (outcome.conflicts.length && !force) throw new SyncConflict(outcome.conflicts, "revert");
    for (const path of outcome.conflicts) {
      if (await lexists(target(path))) {
        await copyForSnapshot(target(path), displacedCopy(snapshot, path));
        outcome.displaced.push(path);
      }
    }
    if (outcome.displaced.length) outcome.displacedDir = displacedCopy(snapshot, "");
    const ordered = [...snapshot.entries].sort((a, b) => Number(a.before === "file") - Number(b.before === "file"));
    for (const entry of ordered) {
      const current = await resolveInside(root, entry.path);
      if (entry.before === "file") {
        await makeParents(root, current, []);
        await install(savedCopy(snapshot, entry.path), current);
        (entry.after_sha256 === null ? outcome.recreated : outcome.restored).push(entry.path);
      } else {
        await remove(current);
        await pruneEmptyParents(root, current);
        outcome.removed.push(entry.path);
      }
    }
    const known = snapshot.entries.filter((entry) => entry.baseline_known);
    for (const entry of known) {
      const change: BaselineChange = { path: entry.path, sha256: entry.manifest_before };
      if (!IS_WINDOWS && entry.manifest_before !== null && (await hashPath(target(entry.path))) === entry.manifest_before) {
        change.executable = await isExecutable(target(entry.path));
      }
      outcome.baseline.push(change);
    }
    const manifest: Record<string, string | null> = {};
    for (const entry of known) manifest[entry.path] = entry.manifest_before;
    const executable: Record<string, boolean> = {};
    for (const change of outcome.baseline) if (change.executable !== undefined) executable[change.path] = change.executable;
    await state.updateManifest(projectId, manifest, executable);
    snapshot.reverted = true;
    await state.saveSnapshot(snapshot);
    return outcome;
  });
}

export async function restoreBaseline(api: Pick<SyncApi, "syncAck"> | null, outcome: RevertOutcome): Promise<void> {
  if (!outcome.baseline.length) return;
  if (!api) {
    outcome.warnings.push(SYNC_LABELS.baselineUnreachable);
    return;
  }
  try {
    await api.syncAck(outcome.projectId, outcome.baseline);
  } catch (error) {
    log.warn(`sync baseline restore failed: ${errorMessage(error)}`);
    outcome.warnings.push(SYNC_LABELS.baselineFailed(errorMessage(error)));
  }
}
