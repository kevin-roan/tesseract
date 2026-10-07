import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { MetricsRow } from "../../shared/contracts/metrics";
import { loadMetrics, parseMetrics, saveMetrics, serializeMetrics } from "./index";

const NOW = 10_000;
const row = (t: number): MetricsRow => [t, 4, 1.23456, 1, 1, 2, 8, 50, 100, 0];
const dirs: string[] = [];

afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe("metrics cache", () => {
  it("drops stale, future and malformed rows", () => {
    const text = JSON.stringify({ version: 1, sandboxes: { a: [row(NOW - 4000), row(NOW - 10), row(NOW + 120), [1, 2, 3], row(NOW - 20)] } });
    expect(parseMetrics(text, NOW).sandboxes.a?.map((entry) => entry[0])).toEqual([NOW - 20, NOW - 10]);
    expect(parseMetrics("nope", NOW).sandboxes).toEqual({});
    expect(parseMetrics(JSON.stringify({ version: 2, sandboxes: {} }), NOW).sandboxes).toEqual({});
  });

  it("keeps the four most recent sandboxes and rounds values", () => {
    const sandboxes = Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`s${index}`, [row(NOW - 100 + index)]]));
    const parsed = JSON.parse(serializeMetrics({ version: 1, sandboxes }, NOW)) as { sandboxes: Record<string, MetricsRow[]> };
    expect(Object.keys(parsed.sandboxes)).toEqual(["s5", "s4", "s3", "s2"]);
    expect(parsed.sandboxes.s5?.[0]?.[2]).toBe(1.2346);
  });

  it("round-trips through the file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "monolith-test-metrics-"));
    dirs.push(dir);
    await saveMetrics(dir, { version: 1, sandboxes: { a: [row(NOW - 5)] } }, NOW);
    expect((await loadMetrics(dir, NOW)).sandboxes.a).toHaveLength(1);
    expect((await loadMetrics(join(dir, "missing"), NOW)).sandboxes).toEqual({});
  });
});
