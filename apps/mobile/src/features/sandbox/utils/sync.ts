import {
  LIMITS,
  type CreateSyncRequest,
  type SyncChangeKind,
  type SyncChanges,
  type SyncDiscard,
  type SyncDiscardResult,
  type SyncFileChange,
  type SyncRequest,
  type SyncRequestKind,
  type SyncRequestStatus,
  type SyncResult,
} from "@theone/protocol";

import type { Tone } from "@/lib/tone";

import { formatRelativeTime, pluralize } from "./format";

export type SyncCounts = Record<SyncChangeKind, number>;

export type SyncRequestView = {
  title: string;
  status: string;
  tone: Tone;
  conflicts: string[];
  conflictsLabel: string;
  active: boolean;
  cancellable: boolean;
};

export type SyncEmptyState = "never-pushed" | "up-to-date" | null;

export type SyncNotice = {
  tone: Tone;
  title: string;
  message: string;
};

export type SyncActionId = SyncRequestKind | "discard";

export type SyncActionReasons = Record<SyncActionId, string | null>;

export type SyncSheetMode = "pull" | "get" | "discard";

export type SyncSheetView = {
  title: string;
  message: string;
  files: SyncFileChange[];
  selectable: boolean;
  force: { label: string; footnote: string } | null;
  confirmLabel: string;
  destructive: boolean;
};

export const SYNC_ACTION_IDS: readonly SyncActionId[] = ["pull", "get", "revert", "discard"];

const KIND_CODES: Record<SyncChangeKind, string> = { added: "A", modified: "M", deleted: "D" };
const KIND_TONES: Record<SyncChangeKind, Tone> = { added: "success", modified: "warning", deleted: "danger" };

export const SYNC_FILE_PREVIEW = 8;
export const SYNC_REQUEST_PREVIEW = 5;
export const SYNC_CONFLICT_PREVIEW = 3;

export const SYNC_COPY = {
  neverPushed: "Run monolith --sync in the project folder on your computer",
  upToDate: "Host is up to date",
  hostUnchanged: "No changes on your computer",
  notLinked: "Not linked — run monolith --sync on your computer",
  offline: "Desktop companion offline — the request waits until it connects",
  pending: "Waiting for Monolith on your computer…",
  inProgress: "A sync is already in progress",
  noFileChanges: "No files changed",
  cancelled: "Cancelled",
  cancelledOnHost: "Nothing was written to your computer",
  failed: "Failed",
  loading: "Checking the sandbox for changes…",
  nothingToRevert: "No sync to host to revert",
  nothingToDiscard: "No sandbox changes to discard",
  notDiscardable: "The synced versions of these files aren't kept in the sandbox",
  cancelledInSandbox: "Nothing was written to the sandbox",
  pullConflicts: "Changed on the host since the push:",
  getConflicts: "Changed in the sandbox since the last sync:",
  pullForceLabel: "Overwrite host edits",
  pullForceFootnote: "The last sync stopped because files changed on your computer. Turn this on to replace them.",
  getForceLabel: "Overwrite sandbox edits",
  getForceFootnote:
    "The last sync from host stopped because files changed in the sandbox. Turn this on to replace them; copies are kept in a backup.",
} as const;

export const SYNC_ACTION_DESCRIPTIONS: Record<SyncActionId, string> = {
  pull: "Copy the sandbox changes to your computer",
  get: "Copy what changed on your computer into the sandbox",
  revert: "Restore the host files from the snapshot taken before the last sync",
  discard: "Put the sandbox files back to the last synced version",
};

const NOTICE_TITLES: Record<SyncRequestKind, Record<SyncRequestStatus, string>> = {
  pull: {
    pending: "Sync queued",
    claimed: "Syncing to host",
    applied: "Synced to host",
    failed: "Sync failed",
    cancelled: "Sync cancelled",
  },
  get: {
    pending: "Sync from host queued",
    claimed: "Syncing from host",
    applied: "Synced from host",
    failed: "Sync from host failed",
    cancelled: "Sync from host cancelled",
  },
  revert: {
    pending: "Revert queued",
    claimed: "Reverting on host",
    applied: "Reverted on host",
    failed: "Revert failed",
    cancelled: "Revert cancelled",
  },
};

export const syncKindCode = (kind: SyncChangeKind): string => KIND_CODES[kind];

export const syncKindTone = (kind: SyncChangeKind): Tone => KIND_TONES[kind];

export function countSyncChanges(changes: readonly SyncFileChange[]): SyncCounts {
  const counts: SyncCounts = { added: 0, modified: 0, deleted: 0 };
  for (const change of changes) counts[change.kind] += 1;
  return counts;
}

export function syncChangesSummary(changes: readonly SyncFileChange[]): string {
  const counts = countSyncChanges(changes);
  const parts = (Object.keys(counts) as SyncChangeKind[])
    .filter((kind) => counts[kind] > 0)
    .map((kind) => `${counts[kind]} ${kind}`);
  return [pluralize(changes.length, "file"), ...parts].join(" · ");
}

export function previewSyncChanges(
  changes: readonly SyncFileChange[],
  expanded: boolean,
  limit: number = SYNC_FILE_PREVIEW,
): { visible: SyncFileChange[]; hidden: number } {
  if (expanded || changes.length <= limit) return { visible: [...changes], hidden: 0 };
  return { visible: changes.slice(0, limit), hidden: changes.length - limit };
}

export function syncFileToggleLabel(total: number, expanded: boolean, limit: number = SYNC_FILE_PREVIEW): string | null {
  if (total <= limit) return null;
  return expanded ? "Show fewer files" : `Show all ${total} files`;
}

export function syncEmptyState(changes: SyncChanges | undefined): SyncEmptyState {
  if (!changes) return null;
  if (changes.baselineAt === null) return "never-pushed";
  return changes.changes.length === 0 ? "up-to-date" : null;
}

/** Why a queued request would not be applied right away, or null when the host is linked and online. */
export function syncHostWarning(changes: SyncChanges | undefined): string | null {
  if (!changes) return null;
  const { host } = changes;
  if (!host || !host.linked) return SYNC_COPY.notLinked;
  return host.online ? null : SYNC_COPY.offline;
}

export function syncHostLabel(changes: SyncChanges | undefined): string | null {
  const host = changes?.host;
  return syncHostWarning(changes) ?? (host ? `Monolith on ${host.name} · online` : null);
}

export function syncDisabledReason(empty: SyncEmptyState, busy: boolean): string | null {
  if (empty === "never-pushed") return SYNC_COPY.neverPushed;
  if (empty === "up-to-date") return SYNC_COPY.upToDate;
  return busy ? SYNC_COPY.inProgress : null;
}

/** Requests wait while the companion is offline, but are never claimed for a project it has not linked. */
function syncHostBlocker(changes: SyncChanges): string | null {
  return changes.host?.linked ? null : SYNC_COPY.notLinked;
}

export const discardableChanges = (changes: readonly SyncFileChange[]): SyncFileChange[] =>
  changes.filter((change) => change.discardable === true);

function discardDisabledReason(changes: readonly SyncFileChange[], busy: boolean): string | null {
  if (changes.length === 0) return SYNC_COPY.nothingToDiscard;
  if (busy) return SYNC_COPY.inProgress;
  return discardableChanges(changes).length > 0 ? null : SYNC_COPY.notDiscardable;
}

const everyAction = (reason: string): SyncActionReasons => ({ pull: reason, get: reason, revert: reason, discard: reason });

/** Why each sync action can't run right now (`null`: it can). */
export function syncActionReasons(
  changes: SyncChanges | undefined,
  requests: readonly SyncRequest[],
  busy: boolean,
): SyncActionReasons {
  if (!changes) return everyAction(SYNC_COPY.loading);
  if (changes.baselineAt === null) return everyAction(SYNC_COPY.neverPushed);
  const host = syncHostBlocker(changes);
  const queue = busy ? SYNC_COPY.inProgress : host;
  return {
    pull: syncDisabledReason(syncEmptyState(changes), busy) ?? host,
    get: queue,
    revert: busy ? SYNC_COPY.inProgress : canRevertLastSync(requests) ? host : SYNC_COPY.nothingToRevert,
    discard: discardDisabledReason(changes.changes, busy),
  };
}

/** Files changed on the host since the last push/get, as its last heartbeat reported; `null`: unknown. */
export function syncHostChanges(changes: SyncChanges | undefined): number | null {
  const host = changes?.host;
  return host?.linked && host.changes !== undefined ? host.changes : null;
}

/** Whether each direction has changes waiting, so the Sync button can stand out. */
export function syncWaiting(changes: SyncChanges | undefined): { pull: boolean; get: boolean } {
  if (!changes || changes.baselineAt === null) return { pull: false, get: false };
  return { pull: changes.changes.length > 0, get: (syncHostChanges(changes) ?? 0) > 0 };
}

export function syncActionDetail(
  id: SyncActionId,
  reason: string | null,
  changes: readonly SyncFileChange[],
  hostChanges: number | null = null,
): string {
  if (reason) return reason;
  if (id === "pull") return `${pluralize(changes.length, "file")} changed in the sandbox`;
  if (id === "get" && hostChanges !== null) {
    return hostChanges > 0 ? `${pluralize(hostChanges, "file")} changed on your computer` : SYNC_COPY.hostUnchanged;
  }
  if (id === "discard") return `${pluralize(discardableChanges(changes).length, "file")} can go back to the last synced version`;
  return SYNC_ACTION_DESCRIPTIONS[id];
}

export const isSyncActionId = (id: string): id is SyncActionId => (SYNC_ACTION_IDS as readonly string[]).includes(id);

export const syncResultFiles = (result: SyncResult | null): number =>
  result ? result.added + result.modified + result.deleted : 0;

export const isSyncRequestActive = (request: SyncRequest): boolean =>
  request.status === "pending" || request.status === "claimed";

export const activeSyncRequest = (requests: readonly SyncRequest[]): SyncRequest | null =>
  requests.find(isSyncRequestActive) ?? null;

const isSettled = (request: SyncRequest): boolean => request.status === "applied" || request.status === "failed";

export function lastFailedOnConflicts(requests: readonly SyncRequest[], kind: SyncRequestKind): boolean {
  const last = requests.find((request) => request.kind === kind && isSettled(request));
  return last?.status === "failed" && (last.result?.conflicts.length ?? 0) > 0;
}

export function canRevertLastSync(requests: readonly SyncRequest[]): boolean {
  for (const request of requests) {
    if (request.status !== "applied" || request.kind === "get") continue;
    return request.kind === "pull";
  }
  return false;
}

function syncRequestTitle(request: SyncRequest): string {
  if (request.kind === "revert") return "Revert last sync";
  if (request.kind === "get") return "Sync from host";
  return request.paths ? `Sync ${pluralize(request.paths.length, "file")}` : "Sync all changes";
}

/** `git diff --stat` style line counts of a `get`, e.g. "+12 −4"; null when the result has none. */
export function syncLineStats(result: SyncResult | null): string | null {
  if (!result || (result.insertions === undefined && result.deletions === undefined)) return null;
  return `+${result.insertions ?? 0} −${result.deletions ?? 0}`;
}

function syncRequestStatus(request: SyncRequest, now: number): { status: string; tone: Tone } {
  const when = formatRelativeTime(request.updatedAt, now);
  const host = request.claimedBy ?? "your computer";
  switch (request.status) {
    case "pending":
      return { status: SYNC_COPY.pending, tone: "info" };
    case "claimed":
      return { status: request.kind === "get" ? `Getting changes from ${host}…` : `Applying on ${host}…`, tone: "info" };
    case "applied": {
      const verb = request.kind === "revert" ? "Reverted" : request.kind === "get" ? "Got" : "Synced";
      const parts = [`${verb} ${pluralize(syncResultFiles(request.result), "file")}`, syncLineStats(request.result), when];
      return { status: parts.filter(Boolean).join(" · "), tone: "success" };
    }
    case "failed":
      return { status: request.error ?? SYNC_COPY.failed, tone: "danger" };
    case "cancelled":
      return { status: `${SYNC_COPY.cancelled} · ${when}`, tone: "neutral" };
  }
}

export function describeSyncRequest(request: SyncRequest, now: number = Date.now()): SyncRequestView {
  return {
    title: syncRequestTitle(request),
    ...syncRequestStatus(request, now),
    conflicts: request.status === "failed" ? (request.result?.conflicts ?? []) : [],
    conflictsLabel: request.kind === "get" ? SYNC_COPY.getConflicts : SYNC_COPY.pullConflicts,
    active: isSyncRequestActive(request),
    cancellable: request.status === "pending",
  };
}

export function syncResultSummary(result: SyncResult | null): string {
  if (!result) return SYNC_COPY.noFileChanges;
  const parts = (["added", "modified", "deleted"] as const)
    .filter((kind) => result[kind] > 0)
    .map((kind) => `${result[kind]} ${kind}`);
  const lines = syncLineStats(result);
  if (lines) parts.push(lines);
  if (result.gitFiles) parts.push(`.git ${pluralize(result.gitFiles, "file")}`);
  if (result.conflicts.length > 0) parts.push(`${pluralize(result.conflicts.length, "conflict")} overwritten`);
  return parts.length > 0 ? parts.join(" · ") : SYNC_COPY.noFileChanges;
}

/** "a, b, c and 2 more". */
export function syncPathsPreview(paths: readonly string[], limit: number = SYNC_CONFLICT_PREVIEW): string {
  const extra = paths.length - limit;
  return `${paths.slice(0, limit).join(", ")}${extra > 0 ? ` and ${extra} more` : ""}`;
}

function syncConflictsLine(conflicts: readonly string[]): string | null {
  return conflicts.length > 0 ? `Conflicts: ${syncPathsPreview(conflicts)}` : null;
}

const backupLine = (backupPath: string | null | undefined): string | null => (backupPath ? `Backup: ${backupPath}` : null);

const lines = (...parts: (string | null)[]): string => parts.filter(Boolean).join("\n");

/** Feedback for one request the user started, kept live by `sync.updated`. */
export function syncRequestNotice(request: SyncRequest, changes: SyncChanges | undefined): SyncNotice {
  const title = NOTICE_TITLES[request.kind][request.status];
  switch (request.status) {
    case "pending":
      return { tone: "info", title, message: syncHostWarning(changes) ?? SYNC_COPY.pending };
    case "claimed":
      return { tone: "info", title, message: describeSyncRequest(request).status };
    case "applied":
      return { tone: "success", title, message: lines(syncResultSummary(request.result), backupLine(request.result?.backupPath)) };
    case "failed":
      return { tone: "danger", title, message: lines(request.error ?? SYNC_COPY.failed, syncConflictsLine(request.result?.conflicts ?? [])) };
    case "cancelled":
      return {
        tone: "neutral",
        title,
        message: request.kind === "get" ? SYNC_COPY.cancelledInSandbox : SYNC_COPY.cancelledOnHost,
      };
  }
}

export const syncFailureTitle = (id: SyncActionId): string =>
  id === "discard" ? "Discard failed" : NOTICE_TITLES[id].failed;

export function syncDiscardNotice(result: SyncDiscardResult): SyncNotice {
  const { discarded, unavailable, backupPath } = result;
  const message = lines(
    discarded.length > 0 ? `${pluralize(discarded.length, "file")} back to the last synced version` : null,
    unavailable.length > 0 ? `Kept (no synced copy): ${syncPathsPreview(unavailable)}` : null,
    backupLine(backupPath),
  );
  if (discarded.length === 0) return { tone: "warning", title: "Nothing discarded", message: message || SYNC_COPY.noFileChanges };
  return { tone: unavailable.length > 0 ? "warning" : "success", title: "Discarded sandbox changes", message };
}

export function syncConfirmMessage(changes: readonly SyncFileChange[]): string {
  return `${syncChangesSummary(changes)}. A snapshot is taken first, so you can revert it.`;
}

export const syncDiscardMessage = (count: number): string =>
  `${pluralize(count, "file")} go back to the last synced version (added files are removed). Copies of the sandbox versions are kept in a backup.`;

export const SYNC_REVERT_CONFIRM = {
  title: "Revert last sync?",
  message: "Monolith restores the host files from the snapshot it took before the last sync.",
  confirmLabel: "Revert",
  cancelLabel: "Keep changes",
  destructive: true,
} as const;

export const syncDiscardConfirm = (paths: readonly string[]) => ({
  title: "Discard sandbox changes?",
  message: `${syncDiscardMessage(paths.length)}\n\n${syncPathsPreview(paths)}`,
  confirmLabel: "Discard",
  cancelLabel: "Keep changes",
  destructive: true,
});

export function describeSyncSheet(
  mode: SyncSheetMode,
  input: { changes: readonly SyncFileChange[]; selected: number; showForce: boolean },
): SyncSheetView {
  switch (mode) {
    case "pull":
      return {
        title: "Sync to host",
        message: syncConfirmMessage(input.changes),
        files: [...input.changes],
        selectable: false,
        force: input.showForce ? { label: SYNC_COPY.pullForceLabel, footnote: SYNC_COPY.pullForceFootnote } : null,
        confirmLabel: `Sync ${pluralize(input.changes.length, "file")}`,
        destructive: false,
      };
    case "get":
      return {
        title: "Sync from host",
        message: `${SYNC_ACTION_DESCRIPTIONS.get}. Sandbox edits to the same files stop it unless you overwrite them.`,
        files: [],
        selectable: false,
        force: input.showForce ? { label: SYNC_COPY.getForceLabel, footnote: SYNC_COPY.getForceFootnote } : null,
        confirmLabel: "Sync from host",
        destructive: false,
      };
    case "discard": {
      const files = discardableChanges(input.changes);
      return {
        title: "Discard changes",
        message: syncDiscardMessage(input.selected),
        files,
        selectable: true,
        force: null,
        confirmLabel: `Discard ${pluralize(input.selected, "file")}`,
        destructive: true,
      };
    }
  }
}

export function syncDiscardBody(paths: readonly string[]): SyncDiscard {
  return paths.length > LIMITS.maxSyncPaths ? {} : { paths: [...paths] };
}

export const syncGetBody = (force: boolean): CreateSyncRequest => ({ kind: "get", force, source: "mobile" });

export function syncPullBody(changes: readonly SyncFileChange[], force: boolean): CreateSyncRequest {
  const paths = changes.length > 0 && changes.length <= LIMITS.maxSyncPaths ? changes.map((change) => change.path) : undefined;
  return { kind: "pull", force, source: "mobile", ...(paths ? { paths } : {}) };
}
