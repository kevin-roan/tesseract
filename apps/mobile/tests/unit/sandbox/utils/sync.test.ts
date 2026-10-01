import type { SyncChanges, SyncFileChange, SyncRequest } from "@theone/protocol";
import { sampleSyncChanges, sampleSyncRequest } from "@theone/protocol/fixtures";

import {
  activeSyncRequest,
  canRevertLastSync,
  countSyncChanges,
  describeSyncRequest,
  lastPullFailedOnConflicts,
  previewSyncChanges,
  SYNC_COPY,
  syncChangesSummary,
  syncDisabledReason,
  syncEmptyState,
  syncFileToggleLabel,
  syncHostLabel,
  syncHostWarning,
  syncKindCode,
  syncKindTone,
  syncPullBody,
  syncRequestNotice,
  syncResultFiles,
  syncResultSummary,
} from "@/features/sandbox/utils/sync";

const NOW = Date.parse(sampleSyncRequest.updatedAt) + 10_000;
const request = (overrides: Partial<SyncRequest> = {}): SyncRequest => ({ ...sampleSyncRequest, ...overrides });
const files = (count: number): SyncFileChange[] =>
  Array.from({ length: count }, (_, index) => ({ path: `src/file-${index}.ts`, kind: "modified", sha256: "c".repeat(64), size: 1 }));
const failedOnConflicts = request({
  status: "failed",
  error: "2 files changed on the host",
  result: { added: 0, modified: 0, deleted: 0, conflicts: ["src/main.ts", "README.md"], snapshotId: null, hostPath: null },
});

describe("change kinds", () => {
  it("maps kinds to A/M/D codes and tones", () => {
    expect(["added", "modified", "deleted"].map((kind) => syncKindCode(kind as SyncFileChange["kind"]))).toEqual(["A", "M", "D"]);
    expect(syncKindTone("added")).toBe("success");
    expect(syncKindTone("modified")).toBe("warning");
    expect(syncKindTone("deleted")).toBe("danger");
  });

  it("counts and summarises changes", () => {
    expect(countSyncChanges(sampleSyncChanges.changes)).toEqual({ added: 1, modified: 1, deleted: 1 });
    expect(syncChangesSummary(sampleSyncChanges.changes)).toBe("3 files · 1 added · 1 modified · 1 deleted");
    expect(syncChangesSummary(files(1))).toBe("1 file · 1 modified");
    expect(syncChangesSummary([])).toBe("0 files");
  });
});

describe("previewSyncChanges", () => {
  it("collapses long lists and expands on demand", () => {
    expect(previewSyncChanges(files(10), false)).toEqual({ visible: files(8), hidden: 2 });
    expect(previewSyncChanges(files(10), true)).toEqual({ visible: files(10), hidden: 0 });
    expect(previewSyncChanges(files(3), false, 2).hidden).toBe(1);
    expect(previewSyncChanges(files(8), false).hidden).toBe(0);
  });

  it("labels the toggle only when the list is long", () => {
    expect(syncFileToggleLabel(8, false)).toBeNull();
    expect(syncFileToggleLabel(12, false)).toBe("Show all 12 files");
    expect(syncFileToggleLabel(12, true)).toBe("Show fewer files");
  });
});

describe("syncEmptyState", () => {
  it("distinguishes never pushed, up to date and pending changes", () => {
    expect(syncEmptyState(undefined)).toBeNull();
    expect(syncEmptyState({ ...sampleSyncChanges, baselineAt: null, changes: [] })).toBe("never-pushed");
    expect(syncEmptyState({ ...sampleSyncChanges, changes: [] })).toBe("up-to-date");
    expect(syncEmptyState(sampleSyncChanges)).toBeNull();
  });
});

describe("syncHostLabel", () => {
  const withHost = (host: SyncChanges["host"]): SyncChanges => ({ ...sampleSyncChanges, host });

  it("describes the host's link and heartbeat", () => {
    expect(syncHostLabel(undefined)).toBeNull();
    expect(syncHostLabel(sampleSyncChanges)).toBe("Monolith on workstation · online");
    expect(syncHostLabel(withHost(null))).toBe(SYNC_COPY.notLinked);
    expect(syncHostLabel(withHost({ ...sampleSyncChanges.host!, linked: false }))).toBe(SYNC_COPY.notLinked);
    expect(syncHostLabel(withHost({ ...sampleSyncChanges.host!, online: false }))).toBe(SYNC_COPY.offline);
  });

  it("warns only when a request would wait for the host", () => {
    expect(syncHostWarning(undefined)).toBeNull();
    expect(syncHostWarning(sampleSyncChanges)).toBeNull();
    expect(syncHostWarning(withHost(null))).toBe(SYNC_COPY.notLinked);
    expect(syncHostWarning(withHost({ ...sampleSyncChanges.host!, online: false }))).toBe(SYNC_COPY.offline);
  });
});

describe("syncDisabledReason", () => {
  it("explains why there is nothing to sync", () => {
    expect(syncDisabledReason(null, false)).toBeNull();
    expect(syncDisabledReason("never-pushed", false)).toBe(SYNC_COPY.neverPushed);
    expect(syncDisabledReason("up-to-date", true)).toBe(SYNC_COPY.upToDate);
    expect(syncDisabledReason(null, true)).toBe(SYNC_COPY.inProgress);
  });
});

describe("syncRequestNotice", () => {
  const offline: SyncChanges = { ...sampleSyncChanges, host: { ...sampleSyncChanges.host!, online: false } };

  it("summarises what a sync wrote", () => {
    expect(syncResultSummary(null)).toBe(SYNC_COPY.noFileChanges);
    expect(syncResultSummary(sampleSyncRequest.result)).toBe("1 added · 1 modified · 1 deleted");
    expect(syncResultSummary({ ...sampleSyncRequest.result!, added: 0, deleted: 0, conflicts: ["a.ts", "b.ts"] })).toBe(
      "1 modified · 2 conflicts overwritten",
    );
    expect(syncResultSummary({ ...sampleSyncRequest.result!, added: 0, modified: 0, deleted: 0 })).toBe(SYNC_COPY.noFileChanges);
  });

  it.each<[Partial<SyncRequest>, SyncChanges | undefined, object]>([
    [{ status: "pending", result: null }, sampleSyncChanges, { tone: "info", title: "Sync queued", message: SYNC_COPY.pending }],
    [{ status: "pending", result: null }, offline, { tone: "info", title: "Sync queued", message: SYNC_COPY.offline }],
    [{ status: "claimed", result: null }, undefined, { tone: "info", title: "Syncing to host", message: "Applying on workstation…" }],
    [{}, undefined, { tone: "success", title: "Synced to host", message: "1 added · 1 modified · 1 deleted" }],
    [{ status: "failed", error: null, result: null }, undefined, { tone: "danger", message: SYNC_COPY.failed }],
    [{ status: "cancelled", result: null }, undefined, { tone: "neutral", message: SYNC_COPY.cancelledOnHost }],
  ])("describes %o", (overrides, changes, notice) => {
    expect(syncRequestNotice(request(overrides), changes)).toMatchObject(notice);
  });

  it("lists the first conflicts of a failed pull", () => {
    const many = request({ ...failedOnConflicts, result: { ...failedOnConflicts.result!, conflicts: ["a", "b", "c", "d", "e"] } });
    expect(syncRequestNotice(failedOnConflicts, undefined).message).toBe("2 files changed on the host\nConflicts: src/main.ts, README.md");
    expect(syncRequestNotice(many, undefined).message).toBe("2 files changed on the host\nConflicts: a, b, c and 2 more");
  });
});

describe("requests", () => {
  it("finds the active request", () => {
    expect(activeSyncRequest([request()])).toBeNull();
    const claimed = request({ id: "sync_claimed", status: "claimed" });
    expect(activeSyncRequest([claimed, request()])).toBe(claimed);
  });

  it("offers force only when the last settled pull failed on conflicts", () => {
    expect(lastPullFailedOnConflicts([])).toBe(false);
    expect(lastPullFailedOnConflicts([failedOnConflicts])).toBe(true);
    expect(lastPullFailedOnConflicts([request({ status: "pending" }), failedOnConflicts])).toBe(true);
    expect(lastPullFailedOnConflicts([request(), failedOnConflicts])).toBe(false);
    expect(lastPullFailedOnConflicts([request({ status: "failed", error: "Offline", result: null })])).toBe(false);
  });

  it("allows a revert only while the newest applied request is a pull", () => {
    expect(canRevertLastSync([])).toBe(false);
    expect(canRevertLastSync([request()])).toBe(true);
    expect(canRevertLastSync([request({ status: "cancelled" }), request()])).toBe(true);
    expect(canRevertLastSync([request({ kind: "revert" }), request()])).toBe(false);
    expect(canRevertLastSync([failedOnConflicts])).toBe(false);
  });

  it("counts the files a result touched", () => {
    expect(syncResultFiles(null)).toBe(0);
    expect(syncResultFiles(sampleSyncRequest.result)).toBe(3);
  });

  it.each<[Partial<SyncRequest>, string, string]>([
    [{ status: "pending", result: null }, SYNC_COPY.pending, "info"],
    [{ status: "claimed", result: null }, "Applying on workstation…", "info"],
    [{ status: "claimed", claimedBy: null, result: null }, "Applying on your computer…", "info"],
    [{}, "Synced 3 files · just now", "success"],
    [{ kind: "revert" }, "Reverted 3 files · just now", "success"],
    [{ status: "failed", error: "Disk full", result: null }, "Disk full", "danger"],
    [{ status: "failed", error: null, result: null }, SYNC_COPY.failed, "danger"],
    [{ status: "cancelled", result: null }, "Cancelled · just now", "neutral"],
  ])("describes %o", (overrides, status, tone) => {
    expect(describeSyncRequest(request(overrides), NOW)).toMatchObject({ status, tone });
  });

  it("titles requests and flags conflicts and cancellable ones", () => {
    expect(describeSyncRequest(request(), NOW).title).toBe("Sync all changes");
    expect(describeSyncRequest(request({ paths: ["a.ts", "b.ts"] }), NOW).title).toBe("Sync 2 files");
    expect(describeSyncRequest(request({ kind: "revert" }), NOW).title).toBe("Revert last sync");
    expect(describeSyncRequest(failedOnConflicts, NOW).conflicts).toEqual(["src/main.ts", "README.md"]);
    expect(describeSyncRequest(request(), NOW)).toMatchObject({ conflicts: [], active: false, cancellable: false });
    expect(describeSyncRequest(request({ status: "pending" }), NOW)).toMatchObject({ active: true, cancellable: true });
    expect(describeSyncRequest(request({ status: "claimed" }), NOW)).toMatchObject({ active: true, cancellable: false });
  });
});

describe("syncPullBody", () => {
  it("pulls exactly the confirmed paths", () => {
    expect(syncPullBody(sampleSyncChanges.changes, true)).toEqual({
      kind: "pull",
      force: true,
      source: "mobile",
      paths: ["src/main.ts", "src/new-file.ts", "README.old.md"],
    });
    expect(syncPullBody([], false)).toEqual({ kind: "pull", force: false, source: "mobile" });
  });
});
