import { LIMITS, type SyncChanges, type SyncDiscardResult, type SyncFileChange, type SyncRequest } from "@theone/protocol";
import { sampleSyncChanges, sampleSyncRequest } from "@theone/protocol/fixtures";

import {
  activeSyncRequest,
  canRevertLastSync,
  countSyncChanges,
  describeSyncRequest,
  describeSyncSheet,
  discardableChanges,
  isSyncActionId,
  lastFailedOnConflicts,
  previewSyncChanges,
  SYNC_COPY,
  syncActionDetail,
  syncActionReasons,
  syncChangesSummary,
  syncDisabledReason,
  syncDiscardBody,
  syncDiscardConfirm,
  syncDiscardNotice,
  syncEmptyState,
  syncFailureTitle,
  syncFileToggleLabel,
  syncGetBody,
  syncHostChanges,
  syncHostLabel,
  syncHostWarning,
  syncWaiting,
  syncKindCode,
  syncKindTone,
  syncLineStats,
  syncPathsPreview,
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
    expect(lastFailedOnConflicts([], "pull")).toBe(false);
    expect(lastFailedOnConflicts([failedOnConflicts], "pull")).toBe(true);
    expect(lastFailedOnConflicts([request({ status: "pending" }), failedOnConflicts], "pull")).toBe(true);
    expect(lastFailedOnConflicts([request(), failedOnConflicts], "pull")).toBe(false);
    expect(lastFailedOnConflicts([request({ status: "failed", error: "Offline", result: null })], "pull")).toBe(false);
    expect(lastFailedOnConflicts([failedOnConflicts], "get")).toBe(false);
    expect(lastFailedOnConflicts([{ ...failedOnConflicts, kind: "get" }, request()], "get")).toBe(true);
  });

  it("allows a revert only while the newest applied request is a pull", () => {
    expect(canRevertLastSync([])).toBe(false);
    expect(canRevertLastSync([request()])).toBe(true);
    expect(canRevertLastSync([request({ status: "cancelled" }), request()])).toBe(true);
    expect(canRevertLastSync([request({ kind: "revert" }), request()])).toBe(false);
    expect(canRevertLastSync([failedOnConflicts])).toBe(false);
    expect(canRevertLastSync([request({ kind: "get" }), request()])).toBe(true);
    expect(canRevertLastSync([request({ kind: "get" })])).toBe(false);
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
    [{ kind: "get" }, "Got 3 files · just now", "success"],
    [{ kind: "get", result: { ...sampleSyncRequest.result!, insertions: 12, deletions: 4 } }, "Got 3 files · +12 −4 · just now", "success"],
    [{ kind: "get", status: "claimed", result: null }, "Getting changes from workstation…", "info"],
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
    expect(describeSyncRequest(request({ kind: "get" }), NOW).title).toBe("Sync from host");
    expect(describeSyncRequest(failedOnConflicts, NOW).conflictsLabel).toBe(SYNC_COPY.pullConflicts);
    expect(describeSyncRequest({ ...failedOnConflicts, kind: "get" }, NOW).conflictsLabel).toBe(SYNC_COPY.getConflicts);
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

const discardable = (change: SyncFileChange): SyncFileChange => ({ ...change, discardable: true });
const linked: SyncChanges = { ...sampleSyncChanges, changes: sampleSyncChanges.changes.map(discardable) };

describe("syncActionReasons", () => {
  it("disables everything while loading or before the first push", () => {
    expect(syncActionReasons(undefined, [], false)).toEqual({
      pull: SYNC_COPY.loading,
      get: SYNC_COPY.loading,
      revert: SYNC_COPY.loading,
      discard: SYNC_COPY.loading,
    });
    expect(Object.values(syncActionReasons({ ...linked, baselineAt: null }, [sampleSyncRequest], false))).toEqual(
      Array(4).fill(SYNC_COPY.neverPushed),
    );
  });

  it("enables every action when there are changes and a revertable pull", () => {
    expect(syncActionReasons(linked, [sampleSyncRequest], false)).toEqual({ pull: null, get: null, revert: null, discard: null });
  });

  it("blocks everything while a request is active", () => {
    expect(syncActionReasons(linked, [sampleSyncRequest], true)).toEqual({
      pull: SYNC_COPY.inProgress,
      get: SYNC_COPY.inProgress,
      revert: SYNC_COPY.inProgress,
      discard: SYNC_COPY.inProgress,
    });
  });

  it("explains an up-to-date sandbox and a missing revert", () => {
    expect(syncActionReasons({ ...linked, changes: [] }, [], false)).toEqual({
      pull: SYNC_COPY.upToDate,
      get: null,
      revert: SYNC_COPY.nothingToRevert,
      discard: SYNC_COPY.nothingToDiscard,
    });
  });

  it("needs a linked host for requests but not for discard; offline requests still queue", () => {
    const notLinked = syncActionReasons({ ...linked, host: null }, [sampleSyncRequest], false);
    expect(notLinked).toEqual({ pull: SYNC_COPY.notLinked, get: SYNC_COPY.notLinked, revert: SYNC_COPY.notLinked, discard: null });
    const offline = syncActionReasons({ ...linked, host: { ...linked.host!, online: false } }, [sampleSyncRequest], false);
    expect(offline).toEqual({ pull: null, get: null, revert: null, discard: null });
  });

  it("allows discard only for files the controller can restore", () => {
    expect(syncActionReasons(sampleSyncChanges, [], false).discard).toBe(SYNC_COPY.notDiscardable);
    const one = { ...sampleSyncChanges, changes: [discardable(sampleSyncChanges.changes[0]), ...sampleSyncChanges.changes.slice(1)] };
    expect(syncActionReasons(one, [], false).discard).toBeNull();
    expect(discardableChanges(one.changes).map((change) => change.path)).toEqual(["src/main.ts"]);
    expect(discardableChanges([{ ...sampleSyncChanges.changes[0], discardable: false }])).toEqual([]);
  });

  it("describes enabled actions and shows the reason otherwise", () => {
    expect(syncActionDetail("get", null, linked.changes)).toBe("Copy what changed on your computer into the sandbox");
    expect(syncActionDetail("discard", null, linked.changes)).toBe("3 files can go back to the last synced version");
    expect(syncActionDetail("revert", SYNC_COPY.nothingToRevert, linked.changes)).toBe(SYNC_COPY.nothingToRevert);
    expect(isSyncActionId("discard")).toBe(true);
    expect(isSyncActionId("sync")).toBe(false);
  });

  it("counts the changes waiting in each direction", () => {
    const withHost = (host: SyncChanges["host"]): SyncChanges => ({ ...sampleSyncChanges, host });
    expect(syncActionDetail("pull", null, linked.changes)).toBe("3 files changed in the sandbox");
    expect(syncActionDetail("get", null, linked.changes, 2)).toBe("2 files changed on your computer");
    expect(syncActionDetail("get", null, linked.changes, 0)).toBe(SYNC_COPY.hostUnchanged);
    const reported = withHost({ ...sampleSyncChanges.host!, changes: 2 });
    expect(syncHostChanges(reported)).toBe(2);
    expect(syncHostChanges(sampleSyncChanges)).toBeNull();
    expect(syncHostChanges(withHost({ ...sampleSyncChanges.host!, linked: false, changes: 2 }))).toBeNull();
    expect(syncWaiting(reported)).toEqual({ pull: true, get: true });
    expect(syncWaiting({ ...reported, changes: [], host: { ...reported.host!, changes: 0 } })).toEqual({ pull: false, get: false });
    expect(syncWaiting({ ...reported, baselineAt: null })).toEqual({ pull: false, get: false });
    expect(syncWaiting(undefined)).toEqual({ pull: false, get: false });
  });
});

describe("get and revert notices", () => {
  const get = (overrides: Partial<SyncRequest> = {}) => request({ kind: "get", result: null, ...overrides });

  it.each<[Partial<SyncRequest>, object]>([
    [{ status: "pending" }, { tone: "info", title: "Sync from host queued", message: SYNC_COPY.pending }],
    [{ status: "claimed" }, { tone: "info", title: "Syncing from host", message: "Getting changes from workstation…" }],
    [{ status: "cancelled" }, { tone: "neutral", title: "Sync from host cancelled", message: SYNC_COPY.cancelledInSandbox }],
  ])("follows a get %o", (overrides, notice) => {
    expect(syncRequestNotice(get(overrides), sampleSyncChanges)).toMatchObject(notice);
  });

  it("summarises line counts, .git files and the backup of an applied get", () => {
    const result = { ...sampleSyncRequest.result!, snapshotId: null, insertions: 8, deletions: 4, gitFiles: 37, backupPath: "/data/backups/x" };
    expect(syncLineStats(null)).toBeNull();
    expect(syncLineStats(sampleSyncRequest.result)).toBeNull();
    expect(syncLineStats(result)).toBe("+8 −4");
    expect(syncRequestNotice(get({ status: "applied", result }), undefined)).toEqual({
      tone: "success",
      title: "Synced from host",
      message: "1 added · 1 modified · 1 deleted · +8 −4 · .git 37 files\nBackup: /data/backups/x",
    });
  });

  it("titles revert notices and failures per action", () => {
    expect(syncRequestNotice(request({ kind: "revert" }), undefined).title).toBe("Reverted on host");
    expect(syncRequestNotice(get({ status: "failed", error: "Conflicts", result: failedOnConflicts.result }), undefined)).toEqual({
      tone: "danger",
      title: "Sync from host failed",
      message: "Conflicts\nConflicts: src/main.ts, README.md",
    });
    expect(syncFailureTitle("pull")).toBe("Sync failed");
    expect(syncFailureTitle("revert")).toBe("Revert failed");
    expect(syncFailureTitle("discard")).toBe("Discard failed");
  });
});

describe("discard", () => {
  const result = (overrides: Partial<SyncDiscardResult> = {}): SyncDiscardResult => ({
    discarded: ["src/main.ts", "src/new-file.ts"],
    unavailable: [],
    backupPath: "/data/sync/discards/1",
    changes: { ...sampleSyncChanges, changes: [] },
    ...overrides,
  });

  it("summarises what was restored, kept and backed up", () => {
    expect(syncDiscardNotice(result())).toEqual({
      tone: "success",
      title: "Discarded sandbox changes",
      message: "2 files back to the last synced version\nBackup: /data/sync/discards/1",
    });
    expect(syncDiscardNotice(result({ unavailable: ["a", "b", "c", "d"], backupPath: null }))).toEqual({
      tone: "warning",
      title: "Discarded sandbox changes",
      message: "2 files back to the last synced version\nKept (no synced copy): a, b, c and 1 more",
    });
    expect(syncDiscardNotice(result({ discarded: [], unavailable: ["a"], backupPath: null }))).toEqual({
      tone: "warning",
      title: "Nothing discarded",
      message: "Kept (no synced copy): a",
    });
    expect(syncDiscardNotice(result({ discarded: [], backupPath: null })).message).toBe(SYNC_COPY.noFileChanges);
  });

  it("names the paths to discard, or every change past the limit", () => {
    expect(syncDiscardBody(["a.ts"])).toEqual({ paths: ["a.ts"] });
    expect(syncDiscardBody(Array.from({ length: LIMITS.maxSyncPaths + 1 }, (_, index) => `f${index}`))).toEqual({});
    expect(syncPathsPreview(["a", "b"])).toBe("a, b");
  });

  it("confirms with the file count and the first paths", () => {
    expect(syncDiscardConfirm(["a.ts", "b.ts"])).toMatchObject({
      title: "Discard sandbox changes?",
      confirmLabel: "Discard",
      destructive: true,
      message: expect.stringMatching(/^2 files go back to the last synced version[\s\S]*\n\na\.ts, b\.ts$/),
    });
  });
});

describe("describeSyncSheet", () => {
  it("lists the files of a pull with its force switch", () => {
    const view = describeSyncSheet("pull", { changes: linked.changes, selected: 0, showForce: true });
    expect(view).toMatchObject({ title: "Sync to host", confirmLabel: "Sync 3 files", selectable: false, destructive: false });
    expect(view.files).toHaveLength(3);
    expect(view.force?.label).toBe(SYNC_COPY.pullForceLabel);
    expect(describeSyncSheet("pull", { changes: linked.changes, selected: 0, showForce: false }).force).toBeNull();
  });

  it("asks before a get without listing files", () => {
    const view = describeSyncSheet("get", { changes: linked.changes, selected: 0, showForce: true });
    expect(view).toMatchObject({ title: "Sync from host", confirmLabel: "Sync from host", files: [] });
    expect(view.force?.label).toBe(SYNC_COPY.getForceLabel);
  });

  it("offers only discardable files, selectable, with a destructive confirm", () => {
    const changes = [discardable(sampleSyncChanges.changes[0]), sampleSyncChanges.changes[1]];
    const view = describeSyncSheet("discard", { changes, selected: 1, showForce: false });
    expect(view).toMatchObject({ title: "Discard changes", confirmLabel: "Discard 1 file", selectable: true, destructive: true, force: null });
    expect(view.files.map((change) => change.path)).toEqual(["src/main.ts"]);
  });

  it("builds the get body", () => {
    expect(syncGetBody(true)).toEqual({ kind: "get", force: true, source: "mobile" });
  });
});
