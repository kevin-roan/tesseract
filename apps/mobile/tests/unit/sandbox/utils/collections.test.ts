import { mergeBySeq, newestFirst, prependCapped, upsertById } from "@/features/sandbox/utils/collections";

type Line = { seq: number; text: string };
const line = (seq: number, text = `line ${seq}`): Line => ({ seq, text });

describe("upsertById", () => {
  const list = [
    { id: "a", value: 1 },
    { id: "b", value: 2 },
  ];

  it("replaces an existing entry in place", () => {
    const next = upsertById(list, { id: "b", value: 20 });
    expect(next).toEqual([
      { id: "a", value: 1 },
      { id: "b", value: 20 },
    ]);
    expect(next).not.toBe(list);
  });

  it("adds new entries at the start by default and at the end on request", () => {
    expect(upsertById(list, { id: "c", value: 3 })[0].id).toBe("c");
    expect(upsertById(list, { id: "c", value: 3 }, "end")[2].id).toBe("c");
  });
});

describe("mergeBySeq", () => {
  it("appends lines that come strictly after the current tail", () => {
    const current = [line(1), line(2)];
    expect(mergeBySeq(current, [line(3), line(4)]).map((entry) => entry.seq)).toEqual([1, 2, 3, 4]);
  });

  it("drops replayed lines and keeps the order after a reconnect", () => {
    const current = [line(1), line(2), line(3)];
    const merged = mergeBySeq(current, [line(2, "dup"), line(3, "dup"), line(4), line(0)]);
    expect(merged.map((entry) => entry.seq)).toEqual([0, 1, 2, 3, 4]);
    expect(merged[2].text).toBe("line 2");
  });

  it("returns the same array when nothing new arrived", () => {
    const current = [line(1), line(2)];
    expect(mergeBySeq(current, [])).toBe(current);
    expect(mergeBySeq(current, [line(1), line(2)])).toBe(current);
  });

  it("keeps only the newest entries past the limit", () => {
    const current = [line(1), line(2), line(3)];
    expect(mergeBySeq(current, [line(4), line(5)], 3).map((entry) => entry.seq)).toEqual([3, 4, 5]);
    expect(mergeBySeq(current, [line(0), line(6)], 2).map((entry) => entry.seq)).toEqual([3, 6]);
  });
});

describe("newestFirst", () => {
  const items = [
    { id: "old", at: "2026-09-20T10:00:00.000Z" },
    { id: "new", at: "2026-09-23T10:00:00.000Z" },
    { id: "mid", at: "2026-09-22T10:00:00.000Z" },
    { id: "bad", at: "nope" },
  ];

  it("sorts by timestamp descending without mutating the input", () => {
    expect(newestFirst(items, (item) => item.at).map((item) => item.id)).toEqual(["new", "mid", "old", "bad"]);
    expect(items[0].id).toBe("old");
  });

  it("applies a limit", () => {
    expect(newestFirst(items, (item) => item.at, 2).map((item) => item.id)).toEqual(["new", "mid"]);
  });
});

describe("prependCapped", () => {
  it("adds to the front and drops the oldest", () => {
    expect(prependCapped([2, 1], 3, 2)).toEqual([3, 2]);
  });
});
