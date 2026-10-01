import {
  LIMITS,
  type CreateSyncRequest,
  type SyncChangeKind,
  type SyncChanges,
  type SyncFileChange,
  type SyncRequest,
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
  active: boolean;
  cancellable: boolean;
};

export type SyncEmptyState = "never-pushed" | "up-to-date" | null;

export type SyncNotice = {
  tone: Tone;
  title: string;
  message: string;
};

const KIND_CODES: Record<SyncChangeKind, string> = { added: "A", modified: "M", deleted: "D" };
const KIND_TONES: Record<SyncChangeKind, Tone> = { added: "success", modified: "warning", deleted: "danger" };

export const SYNC_FILE_PREVIEW = 8;
export const SYNC_REQUEST_PREVIEW = 5;
export const SYNC_CONFLICT_PREVIEW = 3;

export const SYNC_COPY = {
  neverPushed: "Run monolith --sync in the project folder on your computer",
  upToDate: "Host is up to date",
  notLinked: "Not linked — run monolith --sync on your computer",
  offline: "Desktop companion offline — the request waits until it connects",
  pending: "Waiting for Monolith on your computer…",
  inProgress: "A sync is already in progress",
  noFileChanges: "No files changed",
  cancelled: "Cancelled",
  cancelledOnHost: "Nothing was written to your computer",
  failed: "Failed",
} as const;

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

export const syncResultFiles = (result: SyncResult | null): number =>
  result ? result.added + result.modified + result.deleted : 0;

export const isSyncRequestActive = (request: SyncRequest): boolean =>
  request.status === "pending" || request.status === "claimed";

export const activeSyncRequest = (requests: readonly SyncRequest[]): SyncRequest | null =>
  requests.find(isSyncRequestActive) ?? null;

const isSettled = (request: SyncRequest): boolean => request.status === "applied" || request.status === "failed";

export function lastPullFailedOnConflicts(requests: readonly SyncRequest[]): boolean {
  const last = requests.find((request) => request.kind === "pull" && isSettled(request));
  return last?.status === "failed" && (last.result?.conflicts.length ?? 0) > 0;
}

export function canRevertLastSync(requests: readonly SyncRequest[]): boolean {
  for (const request of requests) {
    if (request.status !== "applied") continue;
    return request.kind === "pull";
  }
  return false;
}

function syncRequestTitle(request: SyncRequest): string {
  if (request.kind === "revert") return "Revert last sync";
  return request.paths ? `Sync ${pluralize(request.paths.length, "file")}` : "Sync all changes";
}

function syncRequestStatus(request: SyncRequest, now: number): { status: string; tone: Tone } {
  const when = formatRelativeTime(request.updatedAt, now);
  switch (request.status) {
    case "pending":
      return { status: SYNC_COPY.pending, tone: "info" };
    case "claimed":
      return { status: `Applying on ${request.claimedBy ?? "your computer"}…`, tone: "info" };
    case "applied": {
      const verb = request.kind === "revert" ? "Reverted" : "Synced";
      return { status: `${verb} ${pluralize(syncResultFiles(request.result), "file")} · ${when}`, tone: "success" };
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
    active: isSyncRequestActive(request),
    cancellable: request.status === "pending",
  };
}

export function syncResultSummary(result: SyncResult | null): string {
  if (!result) return SYNC_COPY.noFileChanges;
  const parts = (["added", "modified", "deleted"] as const)
    .filter((kind) => result[kind] > 0)
    .map((kind) => `${result[kind]} ${kind}`);
  if (result.conflicts.length > 0) parts.push(`${pluralize(result.conflicts.length, "conflict")} overwritten`);
  return parts.length > 0 ? parts.join(" · ") : SYNC_COPY.noFileChanges;
}

function syncConflictsLine(conflicts: readonly string[], limit: number = SYNC_CONFLICT_PREVIEW): string | null {
  if (conflicts.length === 0) return null;
  const extra = conflicts.length - limit;
  return `Conflicts: ${conflicts.slice(0, limit).join(", ")}${extra > 0 ? ` and ${extra} more` : ""}`;
}

/** Feedback for one request the user started, kept live by `sync.updated`. */
export function syncRequestNotice(request: SyncRequest, changes: SyncChanges | undefined): SyncNotice {
  switch (request.status) {
    case "pending":
      return { tone: "info", title: "Sync queued", message: syncHostWarning(changes) ?? SYNC_COPY.pending };
    case "claimed":
      return { tone: "info", title: "Syncing to host", message: describeSyncRequest(request).status };
    case "applied":
      return { tone: "success", title: "Synced to host", message: syncResultSummary(request.result) };
    case "failed": {
      const lines = [request.error ?? SYNC_COPY.failed, syncConflictsLine(request.result?.conflicts ?? [])];
      return { tone: "danger", title: "Sync failed", message: lines.filter(Boolean).join("\n") };
    }
    case "cancelled":
      return { tone: "neutral", title: "Sync cancelled", message: SYNC_COPY.cancelledOnHost };
  }
}

export function syncConfirmMessage(changes: readonly SyncFileChange[]): string {
  return `${syncChangesSummary(changes)}. A snapshot is taken first, so you can revert it.`;
}

export function syncPullBody(changes: readonly SyncFileChange[], force: boolean): CreateSyncRequest {
  const paths = changes.length > 0 && changes.length <= LIMITS.maxSyncPaths ? changes.map((change) => change.path) : undefined;
  return { kind: "pull", force, source: "mobile", ...(paths ? { paths } : {}) };
}
