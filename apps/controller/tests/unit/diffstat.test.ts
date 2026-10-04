import { describe, expect, test } from "bun:test";
import type { SyncFileStat, SyncRequest } from "@theone/protocol";
import { formatDiffstat, formatModeChanges } from "../../src/cli/diffstat";
import { formatAgo, formatGetResult } from "../../src/cli/monolith";
import { countLineChanges, isBinary, splitLines } from "../../src/core/line-diff";

const bytes = (text: string) => new TextEncoder().encode(text);
const lines = (text: string) => splitLines(bytes(text));

function stat(path: string, insertions: number, deletions: number, extra: Partial<SyncFileStat> = {}): SyncFileStat {
  return { path, kind: "modified", insertions, deletions, binary: false, oldMode: "100644", newMode: "100644", oldSize: 1, newSize: 1, ...extra };
}

describe("line diff", () => {
  test("counts lines like git, including a last line without a newline", () => {
    expect(lines("")).toEqual([]);
    expect(lines("a\nb\n")).toEqual(["a", "b"]);
    expect(lines("a\nb")).toEqual(["a", "b"]);
    expect(lines("\n")).toEqual([""]);
  });

  test("insertions and deletions match git diff --numstat", () => {
    expect(countLineChanges(lines("a\nb\nc\n"), lines("a\nb\nc\n"))).toEqual({ insertions: 0, deletions: 0 });
    expect(countLineChanges(lines("a\nb\nc\n"), lines("a\nB\nc\nd\n"))).toEqual({ insertions: 2, deletions: 1 });
    expect(countLineChanges([], lines("x\ny\n"))).toEqual({ insertions: 2, deletions: 0 });
    expect(countLineChanges(lines("x\ny\n"), [])).toEqual({ insertions: 0, deletions: 2 });
    expect(countLineChanges(lines("a\nb\nc\nd\ne\n"), lines("e\nd\nc\nb\na\n"))).toEqual({ insertions: 4, deletions: 4 });
    expect(countLineChanges(lines("a"), lines("a\n"))).toEqual({ insertions: 0, deletions: 0 });
  });

  test("past the edit limit every differing line counts", () => {
    const before = Array.from({ length: 50 }, (_, i) => `old ${i}`);
    const after = Array.from({ length: 40 }, (_, i) => `new ${i}`);
    expect(countLineChanges(before, after, 10)).toEqual({ insertions: 40, deletions: 50 });
  });

  test("binary detection looks for a NUL byte in the first 8000 bytes", () => {
    expect(isBinary(bytes("plain text"))).toBe(false);
    expect(isBinary(new Uint8Array([1, 0, 2]))).toBe(true);
    const late = new Uint8Array(9000).fill(65);
    late[8500] = 0;
    expect(isBinary(late)).toBe(false);
  });
});

describe("diffstat", () => {
  const style = { width: 80, color: false };

  test("aligns names and counts and sums the totals", () => {
    expect(formatDiffstat([stat("src/app.ts", 8, 4), stat("README.md", 1, 0), stat("logo.png", 0, 0, { binary: true, oldSize: 1204, newSize: 2048 })], style)).toEqual([
      " src/app.ts |  12 ++++++++----",
      " README.md  |   1 +",
      " logo.png   | Bin 1204 -> 2048 bytes",
      " 3 files changed, 9 insertions(+), 4 deletions(-)",
    ]);
  });

  test("scales big changes to the graph width and keeps both signs visible", () => {
    const [line] = formatDiffstat([stat("big.ts", 1000, 1)], style);
    expect(line).toBe(` big.ts | 1001 ${"+".repeat(39)}-`);
  });

  test("a mode-only change has a zero count and no graph", () => {
    expect(formatDiffstat([stat("run.sh", 0, 0, { newMode: "100755" })], style)).toEqual([" run.sh | 0", " 1 file changed"]);
  });

  test("long names are shortened from the left on narrow terminals", () => {
    const [line] = formatDiffstat([stat(`very/long/${"x".repeat(60)}/file.ts`, 3, 0)], { width: 50, color: false });
    expect(line!.length).toBeLessThanOrEqual(50);
    expect(line).toStartWith(" ...");
    expect(line).toEndWith("file.ts | 3 +++");
  });

  test("colors only the graph", () => {
    expect(formatDiffstat([stat("a", 1, 1)], { width: 80, color: true })[0]).toBe(" a | 2 \x1b[32m+\x1b[m\x1b[31m-\x1b[m");
  });

  test("create, delete and mode change lines", () => {
    expect(
      formatModeChanges([
        stat("new.ts", 1, 0, { kind: "added", oldMode: null }),
        stat("old.ts", 0, 1, { kind: "deleted", newMode: null }),
        stat("run.sh", 0, 0, { newMode: "100755" }),
        stat("same.ts", 1, 1),
      ]),
    ).toEqual([" create mode 100644 new.ts", " delete mode 100644 old.ts", " mode change 100644 => 100755 run.sh"]);
  });
});

describe("monolith --get output", () => {
  const now = Date.parse("2026-10-01T12:00:00Z");
  const request: SyncRequest = {
    id: "sync_7m3k9p2q4r",
    projectId: "app",
    kind: "get",
    status: "applied",
    paths: null,
    force: true,
    source: "cli",
    claimedBy: "laptop",
    result: {
      added: 0,
      modified: 1,
      deleted: 0,
      conflicts: ["a.ts"],
      snapshotId: null,
      hostPath: "/home/me/app",
      files: [stat("a.ts", 1, 1)],
      insertions: 1,
      deletions: 1,
      gitFiles: 3,
      syncedAt: "2026-10-01T12:00:00.000Z",
      previousSyncAt: "2026-10-01T10:00:00.000Z",
      backupPath: "/backups/app/sync_7m3k9p2q4r",
    },
    error: null,
    createdAt: "2026-10-01T12:00:00.000Z",
    updatedAt: "2026-10-01T12:00:00.000Z",
  };

  test("reads like git pull, with the sync times", () => {
    const lines = formatGetResult(request, { width: 80, color: false }, now);
    expect(lines.slice(0, 3)).toEqual(["From laptop:/home/me/app", " a.ts | 2 +-", " 1 file changed, 1 insertion(+), 1 deletion(-)"]);
    expect(lines).toContain("Updated .git (3 files)");
    expect(lines).toContain("Overwrote 1 sandbox edit (--force); copies are in /backups/app/sync_7m3k9p2q4r");
    expect(lines.at(-1)).toMatch(/^Synced at .+ · previous sync .+ \(2 hours ago\)$/);
  });

  test("relative times", () => {
    expect(formatAgo("2026-10-01T11:59:30Z", now)).toBe("just now");
    expect(formatAgo("2026-10-01T11:59:00Z", now)).toBe("1 minute ago");
    expect(formatAgo("2026-09-28T12:00:00Z", now)).toBe("3 days ago");
  });
});
