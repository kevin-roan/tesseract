import { lstat, readFile, readlink } from "node:fs/promises";
import type { FileDiff as FileDiffContract, FileDiffLine } from "../../shared/contracts/syncback";
import type { ByteStream, SyncApi } from "./api";
import { BINARY_SNIFF_BYTES, CONTEXT_LINES, MAX_DIFF_LINES, MAX_PREVIEW_BYTES } from "./constants";
import { SequenceMatcher } from "./difflib";
import { TooLarge, isMissing } from "./errors";
import { resolveInside, resolvePath } from "./manifest";
import { memberName, requireLink } from "./pull";
import type { SyncState } from "./state";
import { readTar } from "./tar";

export type DiffState = "text" | "binary" | "too_large" | "identical" | "empty";
export type LineKind = "hunk" | "add" | "del" | "ctx" | "note";

export interface DiffLine {
  kind: LineKind;
  text: string;
  old: number | null;
  new: number | null;
}

export interface FileDiff {
  state: DiffState;
  lines: DiffLine[];
  added: number;
  removed: number;
  truncated: boolean;
  beforeSize: number | null;
  afterSize: number | null;
}

const LINE_BREAK = /\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/g;
const TRAILING_NEWLINES = /[\r\n]+$/;
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

export async function readHostFile(root: string, rel: string, limit = MAX_PREVIEW_BYTES): Promise<Uint8Array | null> {
  const path = await resolveInside(root, rel);
  let info;
  try {
    info = await lstat(path);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  if (info.isSymbolicLink()) return readlink(path, { encoding: "buffer" });
  if (!info.isFile()) return null;
  if (info.size > limit) throw new TooLarge(info.size);
  return readFile(path);
}

export async function extractMember(archive: ByteStream, rel: string, limit = MAX_PREVIEW_BYTES): Promise<Uint8Array | null> {
  let found: Uint8Array | null = null;
  await readTar(archive, async (member, body) => {
    if (memberName(member.name, false) !== rel) return;
    if (member.isSymlink) {
      found = Buffer.from(member.linkname);
      return "stop";
    }
    if (!member.isRegular) return "stop";
    if (member.size > limit) throw new TooLarge(member.size);
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(chunk);
    found = Buffer.concat(chunks);
    return "stop";
  });
  return found;
}

export function splitLines(text: string): string[] {
  const lines: string[] = [];
  let start = 0;
  for (const match of text.matchAll(LINE_BREAK)) {
    const end = (match.index as number) + match[0].length;
    lines.push(text.slice(start, end));
    start = end;
  }
  if (start < text.length) lines.push(text.slice(start));
  return lines;
}

function decode(data: Uint8Array): string[] | null {
  if (data.subarray(0, BINARY_SNIFF_BYTES).includes(0)) return null;
  try {
    return splitLines(decoder.decode(data));
  } catch {
    return null;
  }
}

function strip(line: string): string {
  return line.replace(TRAILING_NEWLINES, "");
}

function sameBytes(a: Uint8Array | null, b: Uint8Array | null): boolean {
  if (a === null || b === null) return a === b;
  return Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(b);
}

export function diffFile(before: Uint8Array | null, after: Uint8Array | null, maxLines = MAX_DIFF_LINES): FileDiff {
  const sizes = { beforeSize: before === null ? null : before.length, afterSize: after === null ? null : after.length };
  const empty = { lines: [], added: 0, removed: 0, truncated: false, ...sizes };
  if (sameBytes(before, after)) return { state: before && before.length ? "identical" : "empty", ...empty };
  const old = decode(before ?? new Uint8Array());
  const next = decode(after ?? new Uint8Array());
  if (old === null || next === null) return { state: "binary", ...empty };
  const lines: DiffLine[] = [];
  let [added, removed, truncated] = [0, 0, false];
  for (const group of new SequenceMatcher(old, next).groupedOpcodes(CONTEXT_LINES)) {
    const first = group[0] as (typeof group)[number];
    const last = group[group.length - 1] as (typeof group)[number];
    lines.push({ kind: "hunk", text: `@@ -${first[1] + 1},${last[2] - first[1]} +${first[3] + 1},${last[4] - first[3]} @@`, old: null, new: null });
    for (const [tag, i1, i2, j1, j2] of group) {
      if (tag === "equal") {
        for (let i = i1; i < i2; i += 1) lines.push({ kind: "ctx", text: strip(old[i] as string), old: i + 1, new: j1 + i - i1 + 1 });
        continue;
      }
      if (tag === "replace" || tag === "delete") {
        for (let i = i1; i < i2; i += 1) lines.push({ kind: "del", text: strip(old[i] as string), old: i + 1, new: null });
        removed += i2 - i1;
      }
      if (tag === "replace" || tag === "insert") {
        for (let j = j1; j < j2; j += 1) lines.push({ kind: "add", text: strip(next[j] as string), old: null, new: j + 1 });
        added += j2 - j1;
      }
    }
    if (lines.length > maxLines) {
      truncated = true;
      break;
    }
  }
  if (!lines.length) return { state: "empty", ...empty };
  return { state: "text", lines: lines.slice(0, maxLines), added, removed, truncated, ...sizes };
}

const CONTRACT_KINDS: Record<LineKind, FileDiffLine["kind"]> = { hunk: "hunk", add: "add", del: "del", ctx: "context", note: "context" };

export function toContractDiff(path: string, diff: FileDiff): FileDiffContract {
  if (diff.state === "binary") return { kind: "binary", path, hostSize: diff.beforeSize, sandboxSize: diff.afterSize };
  if (diff.state === "too_large") return { kind: "too_large", path, size: diff.afterSize ?? diff.beforeSize ?? 0 };
  return {
    kind: "text",
    path,
    truncated: diff.truncated,
    lines: diff.lines.map((line) => ({ kind: CONTRACT_KINDS[line.kind], oldLine: line.old, newLine: line.new, text: line.text })),
  };
}

export async function previewDiff(api: SyncApi, state: SyncState, projectId: string, path: string): Promise<FileDiff> {
  const link = await requireLink(state, projectId);
  const root = await resolvePath(link.hostPath);
  const change = (await api.syncChanges(projectId)).changes.find((candidate) => candidate.path === path);
  try {
    const before = await readHostFile(root, path);
    let after: Uint8Array | null = null;
    if (change?.kind !== "deleted") {
      if (change?.size != null && change.size > MAX_PREVIEW_BYTES) throw new TooLarge(change.size);
      after = await extractMember(await api.syncExport(projectId, [path]), path);
    }
    return diffFile(before, after);
  } catch (error) {
    if (error instanceof TooLarge) {
      return { state: "too_large", lines: [], added: 0, removed: 0, truncated: false, beforeSize: null, afterSize: error.size };
    }
    throw error;
  }
}
