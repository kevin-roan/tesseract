import { SYNC_LABELS } from "./labels";

const W = SYNC_LABELS.words;

export interface ResultLike {
  added?: number;
  modified?: number;
  deleted?: number;
  hostPath?: string | null;
  insertions?: number;
  deletions?: number | null;
  gitFiles?: number;
  backupPath?: string | null;
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function breakdown(...counts: [number, string][]): string {
  return counts
    .filter(([count]) => count)
    .map(([count, label]) => `${count} ${label}`)
    .join(", ");
}

export interface PullCounts {
  added: string[];
  modified: string[];
  deleted: string[];
  hostPath: string;
  snapshotId: string | null;
  dryRun: boolean;
}

export interface RevertCounts {
  restored: string[];
  recreated: string[];
  removed: string[];
  hostPath: string;
  snapshotId: string;
}

export function describePull(outcome: PullCounts): string {
  const counts = breakdown([outcome.added.length, W.added], [outcome.modified.length, W.modified], [outcome.deleted.length, W.deleted]);
  const total = outcome.added.length + outcome.modified.length + outcome.deleted.length;
  if (total === 0) return SYNC_LABELS.nothingToSync(outcome.hostPath);
  if (outcome.dryRun) return SYNC_LABELS.wouldPull(plural(total, W.file), outcome.hostPath, counts);
  return SYNC_LABELS.pulled(plural(total, W.file), outcome.hostPath, counts, outcome.snapshotId);
}

export function describeRevert(outcome: RevertCounts): string {
  const counts = breakdown(
    [outcome.restored.length, W.restored],
    [outcome.recreated.length, W.recreated],
    [outcome.removed.length, W.removed],
  );
  return SYNC_LABELS.revertedSnapshot(outcome.snapshotId, outcome.hostPath, counts || SYNC_LABELS.noFiles);
}

function count(result: ResultLike, key: "added" | "modified" | "deleted"): number {
  const value = result[key];
  return typeof value === "number" ? value : 0;
}

export function describeGet(result: ResultLike): string {
  const [added, modified, deleted] = [count(result, "added"), count(result, "modified"), count(result, "deleted")];
  const total = added + modified + deleted;
  const counts = breakdown([added, W.added], [modified, W.modified], [deleted, W.deleted]);
  const parts = [total ? SYNC_LABELS.sent(plural(total, W.file), counts) : SYNC_LABELS.upToDate];
  if (total && "insertions" in result) parts.push(SYNC_LABELS.lineCounts(result.insertions, result.deletions ?? 0));
  if (result.gitFiles) parts.push(SYNC_LABELS.gitUpdated(plural(Number(result.gitFiles), W.file)));
  if (result.backupPath) parts.push(SYNC_LABELS.backupKept(String(result.backupPath)));
  return parts.join(SYNC_LABELS.summarySeparator);
}

export function describeResult(kind: string, result: ResultLike): string {
  if (kind === "get") return describeGet(result);
  const [added, modified, deleted] = [count(result, "added"), count(result, "modified"), count(result, "deleted")];
  const where = result.hostPath || "";
  if (kind === "revert") {
    const counts = breakdown([modified, W.restored], [added, W.recreated], [deleted, W.removed]);
    return SYNC_LABELS.revertedLast(where, counts || SYNC_LABELS.noFiles);
  }
  const counts = breakdown([added, W.added], [modified, W.modified], [deleted, W.deleted]);
  return SYNC_LABELS.pulledResult(plural(added + modified + deleted, W.file), where, counts || SYNC_LABELS.noChanges);
}
