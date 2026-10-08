import type { SyncFileStat } from "@tesseract/protocol";

export type DiffstatStyle = { width: number; color: boolean };

const MAX_GRAPH = 40;
const MIN_GRAPH = 6;
const MIN_NAME = 10;
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[m";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function scale(value: number, width: number, max: number): number {
  if (value === 0 || max <= width) return value;
  return 1 + Math.floor((value * (width - 1)) / max);
}

function bar(file: SyncFileStat, width: number, max: number): [number, number] {
  const { insertions: added, deletions: deleted } = file;
  let total = scale(added + deleted, width, max);
  if (total < 2 && added > 0 && deleted > 0) total = 2;
  if (added < deleted) {
    const plus = scale(added, width, max);
    return [plus, total - plus];
  }
  const minus = scale(deleted, width, max);
  return [total - minus, minus];
}

const fitName = (name: string, width: number) => (name.length <= width ? name.padEnd(width) : `...${name.slice(name.length - width + 3)}`);

/** `git diff --stat` lines: one per file, then the totals line. */
export function formatDiffstat(files: readonly SyncFileStat[], style: DiffstatStyle): string[] {
  if (files.length === 0) return [];
  const counts = files.map((file) => (file.binary ? "Bin" : String(file.insertions + file.deletions)));
  const countWidth = Math.max(...counts.map((count) => count.length));
  const maxChange = Math.max(0, ...files.filter((file) => !file.binary).map((file) => file.insertions + file.deletions));
  const fixed = 1 + 3 + countWidth + 1;
  let graphWidth = Math.min(maxChange, MAX_GRAPH);
  let nameWidth = Math.max(...files.map((file) => file.path.length));
  if (nameWidth + graphWidth + fixed > style.width) {
    if (graphWidth > MIN_GRAPH) graphWidth = Math.max(MIN_GRAPH, Math.min(graphWidth, Math.floor((style.width * 3) / 8) - countWidth - 6));
    nameWidth = Math.max(MIN_NAME, Math.min(nameWidth, style.width - fixed - graphWidth));
  }
  const paint = (text: string, color: string) => (style.color && text ? `${color}${text}${RESET}` : text);
  const lines = files.map((file, index) => {
    const head = ` ${fitName(file.path, nameWidth)} | ${counts[index]!.padStart(countWidth)}`;
    if (file.binary) return `${head} ${file.oldSize ?? 0} -> ${file.newSize ?? 0} bytes`;
    const [plus, minus] = bar(file, graphWidth, maxChange);
    const graph = paint("+".repeat(plus), GREEN) + paint("-".repeat(minus), RED);
    return graph ? `${head} ${graph}` : head;
  });
  const insertions = files.reduce((sum, file) => sum + file.insertions, 0);
  const deletions = files.reduce((sum, file) => sum + file.deletions, 0);
  const totals = [`${plural(files.length, "file")} changed`];
  if (insertions > 0) totals.push(`${plural(insertions, "insertion")}(+)`);
  if (deletions > 0) totals.push(`${plural(deletions, "deletion")}(-)`);
  return [...lines, ` ${totals.join(", ")}`];
}

/** `git pull` summary lines: created and deleted files, and mode changes. */
export function formatModeChanges(files: readonly SyncFileStat[]): string[] {
  return files.flatMap((file) => {
    if (file.kind === "added" && file.newMode) return [` create mode ${file.newMode} ${file.path}`];
    if (file.kind === "deleted" && file.oldMode) return [` delete mode ${file.oldMode} ${file.path}`];
    if (file.oldMode && file.newMode && file.oldMode !== file.newMode) return [` mode change ${file.oldMode} => ${file.newMode} ${file.path}`];
    return [];
  });
}
