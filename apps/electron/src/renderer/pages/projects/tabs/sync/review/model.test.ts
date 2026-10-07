import type { SyncFileChange } from "@theone/protocol";
import { describe, expect, it } from "vitest";
import { confirmLabel, diffDisplay, filterReviewFiles, kindCounts, sortReviewFiles, splitMiddle, splitPath } from "./model";

const change = (path: string, kind: SyncFileChange["kind"] = "modified", size: number | null = 10): SyncFileChange => ({ path, kind, size, sha256: null });

describe("review model", () => {
  it("sorts conflicts first, then by path", () => {
    const files = [change("b"), change("a"), change("c")];
    expect(sortReviewFiles(files, ["c"]).map((file) => file.path)).toEqual(["c", "a", "b"]);
  });

  it("filters case-insensitively on the full path", () => {
    expect(filterReviewFiles([change("src/App.tsx"), change("README.md")], " app").map((file) => file.path)).toEqual(["src/App.tsx"]);
  });

  it("splits paths and long names", () => {
    expect(splitPath("a/b/c.ts")).toEqual({ directory: "a/b", name: "c.ts" });
    expect(splitPath("c.ts")).toEqual({ directory: "", name: "c.ts" });
    expect(splitMiddle("short")).toEqual({ head: "short", tail: "" });
    expect(splitMiddle("a-really-long-file-name.tsx").tail).toBe("e-name.tsx");
  });

  it("counts kinds in order", () => {
    expect(kindCounts([change("a", "deleted"), change("b", "added"), change("c", "added")]).map((count) => `${count.code} ${count.label}`)).toEqual([
      "A 2 added",
      "D 1 deleted",
    ]);
  });

  it("labels the confirm button", () => {
    expect(confirmLabel(12, 0)).toBe("Sync 12 files");
    expect(confirmLabel(1, 0)).toBe("Sync 1 file");
    expect(confirmLabel(3, 1)).toBe("Overwrite and Sync");
  });

  it("maps diff results to messages and lines", () => {
    const file = change("a.ts");
    expect(diffDisplay(null, null)).toEqual({ kind: "message", message: "Select a file to see what changes on the host" });
    expect(diffDisplay(file, { status: "loading" })).toEqual({ kind: "message", message: "Loading the diff…" });
    expect(diffDisplay(file, { status: "error", message: "nope" })).toEqual({ kind: "message", message: "Couldn't load the diff: nope" });
    expect(diffDisplay(change("big", "added", 2_000_000), { status: "loading" })).toEqual({ kind: "message", message: "Too large to preview (1.9 MB)" });
    expect(diffDisplay(file, { status: "ready", diff: { kind: "binary", path: "a", hostSize: null, sandboxSize: 2048 } })).toEqual({
      kind: "message",
      message: "Binary file, none → 2 KB",
    });
    expect(diffDisplay(file, { status: "ready", diff: { kind: "text", path: "a", lines: [], truncated: false } })).toEqual({
      kind: "message",
      message: "Same content as the host copy",
    });
    expect(diffDisplay(change("e", "added", 0), { status: "ready", diff: { kind: "text", path: "e", lines: [], truncated: false } })).toEqual({
      kind: "message",
      message: "Empty file",
    });
    const lines = diffDisplay(file, {
      status: "ready",
      diff: {
        kind: "text",
        path: "a",
        truncated: true,
        lines: [
          { kind: "hunk", oldLine: null, newLine: null, text: "@@ -1 +1 @@" },
          { kind: "del", oldLine: 1, newLine: null, text: "a" },
          { kind: "add", oldLine: null, newLine: 1, text: "b" },
          { kind: "add", oldLine: null, newLine: 2, text: "c" },
        ],
      },
    });
    expect(lines).toMatchObject({ kind: "lines", added: 2, removed: 1, footnote: "Diff cut off after 4 lines" });
  });
});
