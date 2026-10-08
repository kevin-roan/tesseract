import type { SyncChanges, SyncRequest } from "@tesseract/protocol";
import { sampleSyncRequest } from "@tesseract/protocol/fixtures";
import { describe, expect, it } from "vitest";
import { formatBytes } from "../../../../features/projects/format";
import {
  changesSubtitle,
  describeResult,
  discardBody,
  discardSummary,
  EMPTY_SYNC_VIEW,
  getConflicts,
  listedPaths,
  plural,
  summaryRows,
  syncBlockers,
  syncConflicts,
  syncNotice,
  syncSections,
  syncWaiting,
  type SyncView,
} from "./model";

const changes = (list: SyncChanges["changes"], baselineAt: string | null = "2026-09-23T10:00:00Z"): SyncChanges => ({
  projectId: "p",
  baselineAt,
  changes: list,
  totalBytes: list.reduce((sum, item) => sum + (item.size ?? 0), 0),
  host: null,
});

const link = { projectId: "p", hostPath: "/home/dev/p", pushedAt: "2026-09-23T10:00:00Z", gotAt: null, confidential: false, files: 1 };
const file = (path: string, discardable = true) => ({ path, kind: "modified" as const, sha256: null, size: 1200, discardable });
const view = (patch: Partial<SyncView>): SyncView => ({ ...EMPTY_SYNC_VIEW, ...patch });
const request = (patch: Partial<SyncRequest>): SyncRequest => ({ ...sampleSyncRequest, ...patch });

describe("sync model", () => {
  it("formats sizes 1024-based", () => {
    expect(formatBytes(568)).toBe("568 B");
    expect(formatBytes(5530)).toBe("5.4 KB");
    expect(formatBytes(550_912)).toBe("538 KB");
    expect(formatBytes(null)).toBe("0 B");
  });

  it("pluralizes files", () => {
    expect(plural(1)).toBe("1 file");
    expect(plural(12)).toBe("12 files");
  });

  it("lists at most 12 paths", () => {
    const paths = Array.from({ length: 14 }, (_, index) => `f${index}`);
    expect(listedPaths(paths).split("\n")).toHaveLength(13);
    expect(listedPaths(paths).endsWith("… and 2 more")).toBe(true);
  });

  it("blocks every action while unlinked and loading", () => {
    const blockers = syncBlockers(EMPTY_SYNC_VIEW);
    expect(blockers.pull).toBe("Not linked on this computer. Run tesseract --sync in the checkout first");
    expect(blockers.revert).toBe("Not linked on this computer. Run tesseract --sync in the checkout first");
    expect(blockers.discard).toBe("Loading the sandbox changes…");
    expect(syncBlockers(view({ error: "x" })).discard).toBe("The sandbox changes couldn't be read");
  });

  it("follows the GTK blocker order", () => {
    expect(syncBlockers(view({ link, changes: changes([], null) })).pull).toBe("Never pushed. Run tesseract --sync in the checkout first");
    expect(syncBlockers(view({ link, changes: changes([]) })).pull).toBe("Nothing to sync. The host folder matches the sandbox");
    expect(syncBlockers(view({ link, changes: changes([]) })).get).toBeNull();
    expect(syncBlockers(view({ link, changes: changes([file("a")]) }), true).pull).toBe("A sync request is already in progress");
    expect(syncBlockers(view({ link, changes: changes([file("a")]), requests: [request({ status: "claimed" })] })).get).toBe(
      "A sync request is already in progress",
    );
    expect(syncBlockers(view({ link, changes: changes([file("a", false)]) })).discard).toBe(
      "The sandbox has no copy of the synced versions of these files",
    );
    expect(syncBlockers(view({ link, changes: changes([file("a")]) })).revert).toBe("No sync to revert");
    const ready = syncBlockers(view({ link, changes: changes([file("a")]), snapshots: [{ id: "s", createdAt: "", entries: 1, reverted: false, kind: "pull" }] }));
    expect(ready).toEqual({ pull: null, get: null, revert: null, discard: null });
  });

  it("marks waiting directions", () => {
    expect(syncWaiting(view({ hostFiles: [{ path: "a", kind: "added" }] })).get).toBe(true);
    expect(syncWaiting(EMPTY_SYNC_VIEW).get).toBe(false);
  });

  it("reads the conflicts of a failed get", () => {
    const failed = request({ kind: "get", status: "failed", result: { added: 0, modified: 0, deleted: 0, conflicts: ["a.ts"], snapshotId: null, hostPath: null } });
    expect(getConflicts(view({ requests: [failed] }))).toEqual(["a.ts"]);
    expect(getConflicts(view({ requests: [request({ kind: "get", status: "applied" }), failed] }))).toEqual([]);
  });

  it("picks the status notice", () => {
    expect(syncNotice(EMPTY_SYNC_VIEW)?.message).toMatch(/^Not linked on this computer/);
    expect(syncNotice(view({ link, error: "down" }))).toEqual({ message: "Couldn't read sandbox changes: down", tone: "warning" });
    expect(syncNotice(view({ link, changes: changes([], null) }))?.message).toBe("The sandbox has no push baseline yet. Run tesseract --sync in /home/dev/p.");
    expect(syncNotice(view({ link, changes: changes([]) }))).toBeNull();
  });

  it("summarises discards", () => {
    expect(discardSummary({ discarded: ["a", "b"], unavailable: [], backupPath: null })).toEqual({ message: "Discarded 2 files in the sandbox", tone: "success" });
    expect(discardSummary({ discarded: [], unavailable: ["c"], backupPath: "/b" })).toEqual({
      message: "Nothing was discarded\n1 file kept, the sandbox has no copy of the synced version: c\nPrevious versions saved in /b",
      tone: "warning",
    });
  });

  it("describes request results", () => {
    expect(describeResult("pull", { added: 1, modified: 2, deleted: 0, hostPath: "/h" })).toBe("Pulled 3 files into /h (1 added, 2 modified)");
    expect(describeResult("pull", { hostPath: "/h" })).toBe("Pulled 0 files into /h (no changes)");
    expect(describeResult("revert", { added: 1, modified: 2, deleted: 0, hostPath: "/h" })).toBe("Reverted the last sync in /h (2 restored, 1 recreated)");
    expect(describeResult("get", { added: 1, modified: 0, deleted: 0, insertions: 4, deletions: 1, gitFiles: 2, backupPath: "/b" })).toBe(
      "Sent 1 file to the sandbox (1 added) · +4 −1 · updated .git (2 files) · sandbox edits kept in /b",
    );
    expect(describeResult("get", {})).toBe("Sandbox already up to date");
  });

  it("builds the summary, subtitle and visible sections", () => {
    const now = Date.parse("2026-09-23T17:00:00Z");
    const linked = view({ link, changes: changes([file("a"), file("b")]) });
    expect(summaryRows(linked, now).map((row) => row.value)).toEqual(["/home/dev/p", "7h ago", "—", "7h ago"]);
    expect(changesSubtitle(linked)).toBe("2 files · 2.3 KB");
    expect(changesSubtitle(view({ link, changes: changes([]) }))).toBeNull();
    expect(syncSections(EMPTY_SYNC_VIEW)).toEqual({ summary: false, changes: false, requests: false, snapshots: false });
  });

  it("mentions files that discard keeps", () => {
    const body = discardBody(view({ changes: changes([file("a"), file("b", false)]) }), ["a"]);
    expect(body.endsWith("\n\n1 file can't be restored by the sandbox and stay as they are.")).toBe(true);
  });
});

describe("syncConflicts", () => {
  const list = [
    { path: "a.ts", kind: "modified" as const, sha256: null, size: 1 },
    { path: "b.ts", kind: "deleted" as const, sha256: null, size: null },
    { path: "c.ts", kind: "added" as const, sha256: null, size: 1 },
  ];

  it("marks sandbox changes whose host copy changed since the push", () => {
    expect(
      syncConflicts(list, [
        { path: "a.ts", kind: "modified" },
        { path: "b.ts", kind: "deleted" },
        { path: "z.ts", kind: "added" },
      ]),
    ).toEqual(["a.ts"]);
  });

  it("is empty without host edits", () => {
    expect(syncConflicts(list, [])).toEqual([]);
  });
});
