import type { SyncChanges, SyncDiscardResult, SyncFileChange, SyncRequest, SyncResult } from "@theone/protocol";
import type { HostChange, SnapshotSummary, SyncLinkSummary } from "../../../../../shared/contracts/syncback";
import type { Tone } from "../../../../theme/colors";
import { formatBytes, formatRelativeTime } from "../../../../features/projects/format";
import { IN_FLIGHT_STATUSES, LISTED_PATHS, SYNC_ACTIONS, SYNC_CODES, SYNC_STATES, UNKNOWN_CODE } from "./constants";
import { RESULT_LABELS, SYNC_BLOCKED, SYNC_KINDS, SYNC_LABELS } from "./labels";

export type SyncAction = (typeof SYNC_ACTIONS)[number];

export interface SyncView {
  link: SyncLinkSummary | null;
  changes: SyncChanges | null;
  requests: SyncRequest[];
  snapshots: SnapshotSummary[];
  conflicts: string[];
  error: string | null;
  hostFiles: HostChange[];
}

export const EMPTY_SYNC_VIEW: SyncView = {
  link: null,
  changes: null,
  requests: [],
  snapshots: [],
  conflicts: [],
  error: null,
  hostFiles: [],
};

export function plural(count: number, word: string = SYNC_LABELS.file): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function syncFiles(view: SyncView): SyncFileChange[] {
  return view.changes?.changes ?? [];
}

export function revertible(view: SyncView): SnapshotSummary | null {
  return view.snapshots.find((snapshot) => !snapshot.reverted) ?? null;
}

export function inFlight(view: SyncView): boolean {
  return view.requests.some((request) => IN_FLIGHT_STATUSES.includes(request.status));
}

export function pushed(view: SyncView): boolean {
  return view.changes !== null && view.changes.baselineAt !== null;
}

export function discardable(view: SyncView): SyncFileChange[] {
  return syncFiles(view).filter((change) => change.discardable === true);
}

export function getConflicts(view: SyncView): string[] {
  const last = view.requests.find((request) => request.kind === "get");
  if (!last || last.status !== "failed") return [];
  return last.result?.conflicts ?? [];
}

export function syncConflicts(changes: readonly SyncFileChange[], hostFiles: readonly HostChange[]): string[] {
  const host = new Map(hostFiles.map((file) => [file.path, file.kind]));
  return changes
    .filter((change) => {
      const kind = host.get(change.path);
      return kind !== undefined && !(kind === "deleted" && change.kind === "deleted");
    })
    .map((change) => change.path);
}

export function isConflict(view: SyncView, path: string): boolean {
  return view.conflicts.includes(path);
}

function firstReason(...checks: [boolean, keyof typeof SYNC_BLOCKED][]): string | null {
  const match = checks.find(([blocked]) => blocked);
  return match ? SYNC_BLOCKED[match[1]] : null;
}

export function syncBlockers(view: SyncView, busy = false): Record<SyncAction, string | null> {
  const linked = view.link !== null;
  const files = syncFiles(view);
  const loaded: [boolean, keyof typeof SYNC_BLOCKED] = [view.changes === null, view.error !== null ? "unavailable" : "loading"];
  const notPushed: [boolean, keyof typeof SYNC_BLOCKED] = [!pushed(view), "neverPushed"];
  const active: [boolean, keyof typeof SYNC_BLOCKED] = [busy || inFlight(view), "active"];
  return {
    pull: firstReason([!linked, "notLinked"], loaded, notPushed, active, [files.length === 0, "nothingToSync"]),
    get: firstReason([!linked, "notLinked"], loaded, notPushed, active),
    revert: firstReason([!linked, "notLinked"], active, [revertible(view) === null, "noSnapshot"]),
    discard: firstReason(loaded, notPushed, active, [files.length === 0, "nothingToDiscard"], [discardable(view).length === 0, "notDiscardable"]),
  };
}

export function syncWaiting(view: SyncView): Record<SyncAction, boolean> {
  return { pull: syncFiles(view).length > 0, get: view.hostFiles.length > 0, revert: false, discard: false };
}

export function listedPaths(paths: readonly string[], limit = LISTED_PATHS): string {
  const lines = paths.slice(0, limit);
  if (paths.length > limit) lines.push(SYNC_LABELS.more(paths.length - limit));
  return lines.join("\n");
}

export function discardSummary(result: Pick<SyncDiscardResult, "discarded" | "unavailable" | "backupPath">): { message: string; tone: Tone } {
  const discarded = result.discarded ?? [];
  const unavailable = result.unavailable ?? [];
  const lines = [discarded.length ? SYNC_LABELS.discarded(plural(discarded.length)) : SYNC_LABELS.discardedNone];
  if (unavailable.length) lines.push(SYNC_LABELS.discardUnavailable(plural(unavailable.length), unavailable.join(RESULT_LABELS.listSeparator)));
  if (result.backupPath) lines.push(SYNC_LABELS.discardBackup(result.backupPath));
  return { message: lines.join("\n"), tone: unavailable.length || !discarded.length ? "warning" : "success" };
}

export function syncChangeCode(kind: string): { code: string; tone: Tone } {
  return SYNC_CODES[kind] ?? UNKNOWN_CODE;
}

export function syncRequestState(status: string): { label: string; tone: Tone } {
  return SYNC_STATES[status] ?? { label: status, tone: "neutral" };
}

function breakdown(...counts: [number, string][]): string {
  return counts
    .filter(([count]) => count)
    .map(([count, label]) => `${count} ${label}`)
    .join(RESULT_LABELS.listSeparator);
}

export function describeResult(kind: string, result: Partial<SyncResult>): string {
  const added = result.added ?? 0;
  const modified = result.modified ?? 0;
  const deleted = result.deleted ?? 0;
  if (kind === "get") {
    const total = added + modified + deleted;
    const counts = breakdown([added, RESULT_LABELS.added], [modified, RESULT_LABELS.modified], [deleted, RESULT_LABELS.deleted]);
    const parts = [total ? RESULT_LABELS.sent(plural(total), counts) : RESULT_LABELS.upToDate];
    if (total && result.insertions !== undefined) parts.push(RESULT_LABELS.lines(result.insertions, result.deletions ?? 0));
    if (result.gitFiles) parts.push(RESULT_LABELS.gitUpdated(plural(result.gitFiles)));
    if (result.backupPath) parts.push(RESULT_LABELS.backupKept(result.backupPath));
    return parts.join(RESULT_LABELS.separator);
  }
  const where = result.hostPath ?? "";
  if (kind === "revert") {
    const counts = breakdown([modified, RESULT_LABELS.restored], [added, RESULT_LABELS.recreated], [deleted, RESULT_LABELS.removed]);
    return RESULT_LABELS.reverted(where, counts || RESULT_LABELS.noFiles);
  }
  const counts = breakdown([added, RESULT_LABELS.added], [modified, RESULT_LABELS.modified], [deleted, RESULT_LABELS.deleted]);
  return RESULT_LABELS.pulled(plural(added + modified + deleted), where, counts || RESULT_LABELS.noChanges);
}

export function requestTitle(request: SyncRequest): string {
  return SYNC_KINDS[request.kind] ?? request.kind;
}

export function requestSubtitle(request: SyncRequest): string | null {
  if (request.error) return request.error;
  if (request.result && request.status === "applied") return describeResult(request.kind, request.result);
  return null;
}

export function requestMeta(request: SyncRequest, now = Date.now()): string {
  return SYNC_LABELS.requestMeta(request.source ?? "", formatRelativeTime(request.createdAt, now));
}

export function snapshotMeta(snapshot: SnapshotSummary, now = Date.now()): string {
  return SYNC_LABELS.snapshotMeta(plural(snapshot.entries), formatRelativeTime(snapshot.createdAt, now));
}

export function changeMeta(view: SyncView, change: SyncFileChange): string | null {
  if (isConflict(view, change.path)) return SYNC_LABELS.conflict;
  return change.size === null || change.size === undefined ? null : formatBytes(change.size);
}

export type SyncNotice = { message: string; tone: Tone } | null;

export function syncNotice(view: SyncView): SyncNotice {
  if (view.link === null) return { message: SYNC_LABELS.notLinked, tone: "neutral" };
  if (view.error !== null) return { message: SYNC_LABELS.error(view.error), tone: "warning" };
  if (view.changes !== null && view.changes.baselineAt === null) return { message: SYNC_LABELS.neverPushed(view.link.hostPath), tone: "neutral" };
  return null;
}

export interface SummaryRow {
  key: string;
  value: string;
}

function relativeOrNever(iso: string | null | undefined, now: number): string {
  return iso ? formatRelativeTime(iso, now) : SYNC_LABELS.never;
}

export function summaryRows(view: SyncView, now = Date.now()): SummaryRow[] {
  if (!view.link) return [];
  return [
    { key: SYNC_LABELS.hostPath, value: view.link.hostPath },
    { key: SYNC_LABELS.pushed, value: relativeOrNever(view.link.pushedAt, now) },
    { key: SYNC_LABELS.got, value: relativeOrNever(view.link.gotAt, now) },
    { key: SYNC_LABELS.baseline, value: relativeOrNever(view.changes?.baselineAt, now) },
  ];
}

export function changesSubtitle(view: SyncView): string | null {
  const files = syncFiles(view);
  if (!view.changes || files.length === 0) return null;
  return SYNC_LABELS.changesSubtitle(plural(files.length), formatBytes(view.changes.totalBytes));
}

export interface SyncSections {
  summary: boolean;
  changes: boolean;
  requests: boolean;
  snapshots: boolean;
}

export function syncSections(view: SyncView): SyncSections {
  const linked = view.link !== null;
  return {
    summary: linked,
    changes: linked || syncFiles(view).length > 0,
    requests: linked || view.requests.length > 0,
    snapshots: linked || view.snapshots.length > 0,
  };
}

export function revertBody(snapshot: SnapshotSummary): string {
  return SYNC_LABELS.revertBody(plural(snapshot.entries));
}

export function getConfirmBody(path: string, conflicts: readonly string[]): string {
  return `${SYNC_LABELS.getBody(path)}\n\n${SYNC_LABELS.getConflicts(plural(conflicts.length), listedPaths(conflicts))}`;
}

export function discardBody(view: SyncView, paths: readonly string[]): string {
  const skipped = syncFiles(view).length - paths.length;
  const body = SYNC_LABELS.discardBody(listedPaths(paths));
  return skipped > 0 ? body + SYNC_LABELS.discardSkipped(plural(skipped)) : body;
}
