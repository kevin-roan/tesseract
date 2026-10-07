export type OpcodeTag = "replace" | "delete" | "insert" | "equal";
export type Opcode = [OpcodeTag, number, number, number, number];
type Match = [number, number, number];

export class SequenceMatcher {
  private readonly b2j = new Map<string, number[]>();

  constructor(
    private readonly a: readonly string[],
    private readonly b: readonly string[],
  ) {
    b.forEach((line, index) => {
      const indices = this.b2j.get(line);
      if (indices) indices.push(index);
      else this.b2j.set(line, [index]);
    });
  }

  findLongestMatch(alo: number, ahi: number, blo: number, bhi: number): Match {
    const { a, b } = this;
    let [besti, bestj, bestsize] = [alo, blo, 0];
    let j2len = new Map<number, number>();
    for (let i = alo; i < ahi; i += 1) {
      const next = new Map<number, number>();
      for (const j of this.b2j.get(a[i] as string) ?? []) {
        if (j < blo) continue;
        if (j >= bhi) break;
        const k = (j2len.get(j - 1) ?? 0) + 1;
        next.set(j, k);
        if (k > bestsize) [besti, bestj, bestsize] = [i - k + 1, j - k + 1, k];
      }
      j2len = next;
    }
    while (besti > alo && bestj > blo && a[besti - 1] === b[bestj - 1]) {
      besti -= 1;
      bestj -= 1;
      bestsize += 1;
    }
    while (besti + bestsize < ahi && bestj + bestsize < bhi && a[besti + bestsize] === b[bestj + bestsize]) bestsize += 1;
    return [besti, bestj, bestsize];
  }

  matchingBlocks(): Match[] {
    const [la, lb] = [this.a.length, this.b.length];
    const queue: [number, number, number, number][] = [[0, la, 0, lb]];
    const blocks: Match[] = [];
    while (queue.length) {
      const [alo, ahi, blo, bhi] = queue.pop() as [number, number, number, number];
      const match = this.findLongestMatch(alo, ahi, blo, bhi);
      const [i, j, k] = match;
      if (!k) continue;
      blocks.push(match);
      if (alo < i && blo < j) queue.push([alo, i, blo, j]);
      if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
    }
    blocks.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
    const merged: Match[] = [];
    let [i1, j1, k1] = [0, 0, 0];
    for (const [i2, j2, k2] of blocks) {
      if (i1 + k1 === i2 && j1 + k1 === j2) {
        k1 += k2;
      } else {
        if (k1) merged.push([i1, j1, k1]);
        [i1, j1, k1] = [i2, j2, k2];
      }
    }
    if (k1) merged.push([i1, j1, k1]);
    merged.push([la, lb, 0]);
    return merged;
  }

  opcodes(): Opcode[] {
    let [i, j] = [0, 0];
    const answer: Opcode[] = [];
    for (const [ai, bj, size] of this.matchingBlocks()) {
      const tag: OpcodeTag | "" = i < ai && j < bj ? "replace" : i < ai ? "delete" : j < bj ? "insert" : "";
      if (tag) answer.push([tag, i, ai, j, bj]);
      [i, j] = [ai + size, bj + size];
      if (size) answer.push(["equal", ai, i, bj, j]);
    }
    return answer;
  }

  groupedOpcodes(n = 3): Opcode[][] {
    const codes = this.opcodes();
    if (!codes.length) codes.push(["equal", 0, 1, 0, 1]);
    const first = codes[0] as Opcode;
    if (first[0] === "equal") codes[0] = ["equal", Math.max(first[1], first[2] - n), first[2], Math.max(first[3], first[4] - n), first[4]];
    const last = codes[codes.length - 1] as Opcode;
    if (last[0] === "equal") {
      codes[codes.length - 1] = ["equal", last[1], Math.min(last[2], last[1] + n), last[3], Math.min(last[4], last[3] + n)];
    }
    const groups: Opcode[][] = [];
    let group: Opcode[] = [];
    for (const code of codes) {
      let [tag, i1, i2, j1, j2] = code;
      if (tag === "equal" && i2 - i1 > n * 2) {
        group.push([tag, i1, Math.min(i2, i1 + n), j1, Math.min(j2, j1 + n)]);
        groups.push(group);
        group = [];
        [i1, j1] = [Math.max(i1, i2 - n), Math.max(j1, j2 - n)];
      }
      group.push([tag, i1, i2, j1, j2]);
    }
    if (group.length && !(group.length === 1 && (group[0] as Opcode)[0] === "equal")) groups.push(group);
    return groups;
  }
}
