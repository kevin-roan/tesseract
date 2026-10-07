import { rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { diffFile, extractMember, readHostFile, splitLines, toContractDiff } from "./diff";
import { TooLarge } from "./errors";
import { SequenceMatcher } from "./difflib";
import { tarBytes, tempDir } from "./testing";

const POSIX = process.platform !== "win32";
const bytes = (text: string) => Buffer.from(text);

async function* once(data: Uint8Array): AsyncGenerator<Uint8Array> {
  yield data;
}

let tmp: string;

beforeEach(async () => {
  tmp = await tempDir("diff");
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe("diffFile", () => {
  it("marks hunks, additions and removals with line numbers", () => {
    const before = Array.from({ length: 20 }, (_, index) => `line ${index + 1}\n`).join("");
    const after = before.replace("line 10\n", "line ten\nline 10.5\n");
    const diff = diffFile(bytes(before), bytes(after));
    expect(diff.state).toBe("text");
    expect([diff.added, diff.removed]).toEqual([2, 1]);
    const kinds = diff.lines.map((line) => line.kind);
    expect(kinds[0]).toBe("hunk");
    expect(kinds.filter((kind) => kind === "ctx")).toHaveLength(6);
    const removed = diff.lines.find((line) => line.kind === "del");
    expect([removed?.text, removed?.old, removed?.new]).toEqual(["line 10", 10, null]);
    expect(diff.lines.filter((line) => line.kind === "add").map((line) => [line.text, line.new])).toEqual([
      ["line ten", 10],
      ["line 10.5", 11],
    ]);
    expect(diff.lines[0]?.text).toBe("@@ -7,7 +7,8 @@");
  });

  it("handles new, deleted, identical, binary and long diffs", () => {
    expect(diffFile(null, bytes("a\nb\n")).added).toBe(2);
    const deleted = diffFile(bytes("a\nb\n"), null);
    expect([deleted.state, deleted.removed, deleted.afterSize]).toEqual(["text", 2, null]);
    expect(diffFile(bytes("same"), bytes("same")).state).toBe("identical");
    expect(diffFile(null, bytes("")).state).toBe("empty");
    expect(diffFile(bytes("a"), bytes("a\n")).removed).toBe(1);
    const binary = diffFile(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0]), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2]));
    expect([binary.state, binary.beforeSize, binary.afterSize]).toEqual(["binary", 6, 7]);
    expect(diffFile(bytes("ok"), Buffer.from([0xff, 0xfe])).state).toBe("binary");
    const long = diffFile(null, bytes("x\n".repeat(50)), 10);
    expect(long.truncated).toBe(true);
    expect(long.lines).toHaveLength(10);
  });

  it("splits lines like Python's splitlines(keepends=True)", () => {
    expect(splitLines("a\r\nb\rc\nd")).toEqual(["a\r\n", "b\r", "c\n", "d"]);
    expect(splitLines("")).toEqual([]);
  });

  it("groups opcodes like difflib", () => {
    const a = "abcdefghijklmnop".split("");
    const b = "abcXefghijklmnYp".split("");
    expect(new SequenceMatcher(a, b).opcodes()).toEqual([
      ["equal", 0, 3, 0, 3],
      ["replace", 3, 4, 3, 4],
      ["equal", 4, 14, 4, 14],
      ["replace", 14, 15, 14, 15],
      ["equal", 15, 16, 15, 16],
    ]);
    expect(new SequenceMatcher(a, b).groupedOpcodes(3)).toEqual([
      [["equal", 0, 3, 0, 3], ["replace", 3, 4, 3, 4], ["equal", 4, 7, 4, 7]],
      [["equal", 11, 14, 11, 14], ["replace", 14, 15, 14, 15], ["equal", 15, 16, 15, 16]],
    ]);
  });

  it("maps to the IPC shape", () => {
    const diff = toContractDiff("a.txt", diffFile(bytes("a\n"), bytes("b\n")));
    expect(diff).toEqual({
      kind: "text",
      path: "a.txt",
      truncated: false,
      lines: [
        { kind: "hunk", oldLine: null, newLine: null, text: "@@ -1,1 +1,1 @@" },
        { kind: "del", oldLine: 1, newLine: null, text: "a" },
        { kind: "add", oldLine: null, newLine: 1, text: "b" },
      ],
    });
    expect(toContractDiff("b.bin", diffFile(Buffer.from([0]), Buffer.from([1, 0])))).toEqual({ kind: "binary", path: "b.bin", hostSize: 1, sandboxSize: 2 });
    const large = { state: "too_large" as const, lines: [], added: 0, removed: 0, truncated: false, beforeSize: null, afterSize: 2_000_000 };
    expect(toContractDiff("big.json", large)).toEqual({ kind: "too_large", path: "big.json", size: 2_000_000 });
  });
});

describe("archive members and host files", () => {
  it("reads one path from an export and refuses large ones", async () => {
    const archive = await tarBytes(async (writer) => {
      await writer.addEntry({ name: ".github/ci.yml", type: "0", mode: 0o644, size: 9, linkname: "", mtime: 0 }, bytes("on: push\n"));
      await writer.addEntry({ name: "src/a.ts", type: "0", mode: 0o644, size: 1, linkname: "", mtime: 0 }, bytes("x"));
    });
    expect(Buffer.from((await extractMember(once(archive), ".github/ci.yml")) ?? []).toString()).toBe("on: push\n");
    expect(await extractMember(once(archive), "missing")).toBeNull();
    await expect(extractMember(once(archive), ".github/ci.yml", 3)).rejects.toBeInstanceOf(TooLarge);
  });

  it.runIf(POSIX)("reads files and symlinks and reports absence", async () => {
    await writeFile(join(tmp, "a.txt"), "hello");
    await symlink("a.txt", join(tmp, "link"));
    expect(Buffer.from((await readHostFile(tmp, "a.txt")) ?? []).toString()).toBe("hello");
    expect(Buffer.from((await readHostFile(tmp, "link")) ?? []).toString()).toBe("a.txt");
    expect(await readHostFile(tmp, "nope.txt")).toBeNull();
    await expect(readHostFile(tmp, "a.txt", 2)).rejects.toBeInstanceOf(TooLarge);
  });
});
