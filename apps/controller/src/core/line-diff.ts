/** Like git: a NUL byte in the first 8000 bytes makes a file binary. */
const BINARY_SNIFF_BYTES = 8000;
const MAX_EDITS = 20_000;

export type LineCounts = { insertions: number; deletions: number };

export function isBinary(bytes: Uint8Array): boolean {
  return bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0);
}

/** Lines as git counts them: a last line without a newline still counts, an empty file has none. */
export function splitLines(bytes: Uint8Array): string[] {
  if (bytes.byteLength === 0) return [];
  const lines = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("latin1").split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

/** Myers' shortest edit script length over two int sequences, or null past `limit` edits. */
function editDistance(a: Int32Array, b: Int32Array, limit: number): number | null {
  const n = a.length;
  const m = b.length;
  const max = Math.min(n + m, limit);
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  for (let d = 0; d <= max; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!) ? v[offset + k + 1]! : v[offset + k - 1]! + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) return d;
    }
  }
  return null;
}

/** `git diff --numstat` style counts between two texts; past `limit` edits every differing line counts. */
export function countLineChanges(before: readonly string[], after: readonly string[], limit = MAX_EDITS): LineCounts {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let endBefore = before.length;
  let endAfter = after.length;
  while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) {
    endBefore--;
    endAfter--;
  }
  const n = endBefore - start;
  const m = endAfter - start;
  if (n === 0 || m === 0) return { insertions: m, deletions: n };
  const ids = new Map<string, number>();
  const encode = (lines: readonly string[], end: number) => {
    const out = new Int32Array(end - start);
    for (let i = start; i < end; i++) {
      const line = lines[i]!;
      let id = ids.get(line);
      if (id === undefined) {
        id = ids.size;
        ids.set(line, id);
      }
      out[i - start] = id;
    }
    return out;
  };
  const edits = editDistance(encode(before, endBefore), encode(after, endAfter), limit);
  if (edits === null) return { insertions: m, deletions: n };
  const common = (n + m - edits) / 2;
  return { insertions: m - common, deletions: n - common };
}
