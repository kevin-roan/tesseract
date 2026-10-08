import type { SyncFileChange } from "@tesseract/protocol";
import type { FileDiff, FileDiffLine } from "../../../../../../shared/contracts/syncback";
import { formatBytes } from "../../../../../features/projects/format";
import { KIND_ORDER, MAX_PREVIEW_BYTES, MIDDLE_ELLIPSIS_TAIL } from "../constants";
import { SYNC_LABELS, SYNC_REVIEW_LABELS } from "../labels";
import { plural, syncChangeCode } from "../model";
import type { Tone } from "../../../../../theme/colors";

export type DiffDisplay =
  | { kind: "message"; message: string }
  | { kind: "lines"; lines: FileDiffLine[]; added: number; removed: number; footnote: string | null };

export type DiffResult = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; diff: FileDiff };

export function sortReviewFiles(files: readonly SyncFileChange[], conflicts: readonly string[]): SyncFileChange[] {
  return [...files].sort((a, b) => {
    const conflictOrder = Number(!conflicts.includes(a.path)) - Number(!conflicts.includes(b.path));
    return conflictOrder || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  });
}

export function filterReviewFiles(files: readonly SyncFileChange[], query: string): SyncFileChange[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...files];
  return files.filter((file) => file.path.toLowerCase().includes(needle));
}

export function splitPath(path: string): { directory: string; name: string } {
  const index = path.lastIndexOf("/");
  return index === -1 ? { directory: "", name: path } : { directory: path.slice(0, index), name: path.slice(index + 1) };
}

export function splitMiddle(text: string, tail = MIDDLE_ELLIPSIS_TAIL): { head: string; tail: string } {
  if (text.length <= tail * 2) return { head: text, tail: "" };
  return { head: text.slice(0, -tail), tail: text.slice(-tail) };
}

export interface KindCount {
  kind: string;
  code: string;
  tone: Tone;
  label: string;
}

export function kindCounts(files: readonly SyncFileChange[]): KindCount[] {
  return KIND_ORDER.flatMap((kind) => {
    const count = files.filter((file) => file.kind === kind).length;
    if (!count) return [];
    const { code, tone } = syncChangeCode(kind);
    return [{ kind, code, tone, label: SYNC_REVIEW_LABELS.kindCount(count, kind) }];
  });
}

export function tooLarge(change: SyncFileChange): boolean {
  return change.kind !== "deleted" && change.size !== null && change.size !== undefined && change.size > MAX_PREVIEW_BYTES;
}

const sizeOrAbsent = (size: number | null) => (size === null ? SYNC_REVIEW_LABELS.absent : formatBytes(size));

export function diffDisplay(change: SyncFileChange | null, result: DiffResult | null): DiffDisplay {
  if (change === null || result === null) return { kind: "message", message: SYNC_REVIEW_LABELS.select };
  if (tooLarge(change)) return { kind: "message", message: SYNC_REVIEW_LABELS.tooLarge(formatBytes(change.size)) };
  if (result.status === "loading") return { kind: "message", message: SYNC_REVIEW_LABELS.loading };
  if (result.status === "error") return { kind: "message", message: SYNC_REVIEW_LABELS.failed(result.message) };
  const diff = result.diff;
  if (diff.kind === "error") return { kind: "message", message: SYNC_REVIEW_LABELS.failed(diff.message) };
  if (diff.kind === "too_large") return { kind: "message", message: SYNC_REVIEW_LABELS.tooLarge(formatBytes(diff.size)) };
  if (diff.kind === "binary") {
    return { kind: "message", message: SYNC_REVIEW_LABELS.binary(sizeOrAbsent(diff.hostSize), sizeOrAbsent(diff.sandboxSize)) };
  }
  if (diff.lines.length === 0) {
    return { kind: "message", message: change.size === 0 || change.kind === "deleted" ? SYNC_REVIEW_LABELS.empty : SYNC_REVIEW_LABELS.identical };
  }
  return {
    kind: "lines",
    lines: diff.lines,
    added: diff.lines.filter((line) => line.kind === "add").length,
    removed: diff.lines.filter((line) => line.kind === "del").length,
    footnote: diff.truncated ? SYNC_REVIEW_LABELS.truncated(diff.lines.length) : null,
  };
}

export function lineSign(line: FileDiffLine): string {
  if (line.kind === "add") return SYNC_REVIEW_LABELS.addSign;
  if (line.kind === "del") return SYNC_REVIEW_LABELS.delSign;
  return "";
}

export function confirmLabel(count: number, conflicts: number): string {
  return conflicts ? SYNC_LABELS.confirmForce : SYNC_LABELS.confirm(plural(count));
}
