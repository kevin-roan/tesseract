import type { SandboxStatus } from "@tesseract/protocol";
import { sampleStatus } from "@tesseract/protocol/fixtures";
import { describe, expect, it } from "vitest";
import type { MetricsCache } from "../../../shared/contracts/metrics";
import {
  cacheFromSamples,
  inWindow,
  MetricsHistory,
  sampleFromRow,
  sampleFromStatus,
  samplesFromCache,
  seriesPoints,
  seriesStats,
  type MetricsSample,
} from "./metrics-history";

const sample = (t: number, extra: Partial<MetricsSample> = {}): MetricsSample => ({
  t,
  cores: 4,
  load1: 2,
  load5: 1,
  load15: 0.5,
  memUsed: 1,
  memTotal: 4,
  diskUsed: 3,
  diskTotal: 10,
  gapBefore: false,
  ...extra,
});

function status(sandboxId: string): SandboxStatus {
  return { ...sampleStatus, sandboxId };
}

describe("samples", () => {
  it("reads a status and computes series values", () => {
    const value = sampleFromStatus(sampleStatus, 10);
    expect(value?.t).toBe(10);
    expect(sampleFromStatus({ ...sampleStatus, resources: { ...sampleStatus.resources, cpu: { ...sampleStatus.resources.cpu, load1: -1 } } }, 1)).toBeNull();
    const points = seriesPoints([sample(0), sample(5)], "load1");
    expect(points).toEqual([[0, 0.5], [5, 0.5]]);
    expect(seriesPoints([sample(0), sample(5, { memTotal: 0 })], "memory")).toEqual([[0, 0.25], [5, null]]);
  });

  it("breaks lines on gaps", () => {
    expect(seriesPoints([sample(0), sample(200), sample(205, { gapBefore: true })], "disk")).toEqual([
      [0, 0.3],
      [200, null],
      [200, 0.3],
      [205, null],
      [205, 0.3],
    ]);
  });

  it("includes the sample just before the window when it is close", () => {
    const samples = [sample(0), sample(90), sample(100)];
    expect(inWindow(samples, 95, 200).map((s) => s.t)).toEqual([90, 100]);
    expect(inWindow([sample(0), sample(100, { gapBefore: true })], 50, 200).map((s) => s.t)).toEqual([100]);
  });

  it("computes stats", () => {
    expect(seriesStats([sample(0, { load1: 4 }), sample(5, { load1: 2 })], "load1", 0)).toEqual({ current: 0.5, average: 0.75, peak: 1 });
    expect(seriesStats([], "load1", 0)).toEqual({ current: null, average: null, peak: null });
  });

  it("drops invalid cache rows", () => {
    expect(sampleFromRow([1, 2, 3])).toBeNull();
    expect(sampleFromRow([1, 4, 1, 1, 1, 1, 1, 1, true, 0])).toBeNull();
    expect(sampleFromRow([1, 4, 1, 1, 1, -1, 1, 1, 1, 0])).toBeNull();
    expect(sampleFromRow([1, 4, 1, 1, 1, 1, 1, 1, 1, 1])?.gapBefore).toBe(true);
  });
});

describe("cache", () => {
  it("parses rows inside the window, sorted", () => {
    const now = 10_000;
    const cache = {
      version: 1,
      sandboxes: {
        a: [
          [now - 10, 4, 1, 1, 1, 1, 2, 1, 2, 0],
          [now - 20, 4, 1, 1, 1, 1, 2, 1, 2, 0],
          [now - 4000, 4, 1, 1, 1, 1, 2, 1, 2, 0],
          [now + 120, 4, 1, 1, 1, 1, 2, 1, 2, 0],
        ],
        b: "nope",
      },
    };
    expect(samplesFromCache(cache, now).a?.map((s) => s.t)).toEqual([now - 20, now - 10]);
    expect(samplesFromCache({ version: 2, sandboxes: {} }, now)).toEqual({});
  });

  it("keeps the four most recent sandboxes and rounds values", () => {
    const now = 5_000;
    const sandboxes = Object.fromEntries(
      [1, 2, 3, 4, 5].map((index) => [`s${index}`, [sample(now - 100 + index, { load1: 1 / 3 })]]),
    );
    const cache = cacheFromSamples(sandboxes, now);
    expect(Object.keys(cache.sandboxes)).toEqual(["s5", "s4", "s3", "s2"]);
    expect(cache.sandboxes.s5?.[0]?.[2]).toBe(0.3333);
  });
});

describe("MetricsHistory", () => {
  it("records, marks gaps and switches sandboxes", () => {
    let now = 1_000;
    const history = new MetricsHistory({ clock: () => now });
    history.record(status("a"));
    now += 5;
    history.record(status("a"));
    history.markBreak();
    now += 5;
    history.record(status("a"));
    expect(history.samples.map((s) => s.gapBefore)).toEqual([false, false, true]);
    now += 5;
    history.record(status("b"));
    expect(history.sandboxId).toBe("b");
    expect(history.samples).toHaveLength(1);
    now += 5;
    history.record(status("a"));
    expect(history.samples).toHaveLength(4);
    expect(history.samples.at(-1)?.gapBefore).toBe(true);
    expect(history.revision).toBe(5);
  });

  it("drops samples from the future when the clock goes back", () => {
    let now = 1_000;
    const history = new MetricsHistory({ clock: () => now });
    history.record(status("a"));
    now = 900;
    history.record(status("a"));
    expect(history.samples.map((s) => s.t)).toEqual([900]);
  });

  it("persists every 30 s and hydrates from the cache", async () => {
    let now = 10_000;
    const saved: MetricsCache[] = [];
    const persistence = {
      load: async (): Promise<MetricsCache> => ({ version: 1, sandboxes: { a: [[now - 60, 4, 1, 1, 1, 1, 2, 1, 2, 0]] } }),
      save: async (cache: MetricsCache) => {
        saved.push(cache);
      },
    };
    const history = new MetricsHistory({ clock: () => now, persistence });
    history.record(status("a"));
    await history.hydrate();
    expect(history.samples.map((s) => s.t)).toEqual([now - 60, now]);
    expect(history.samples[1]?.gapBefore).toBe(true);
    now += 31;
    history.record(status("a"));
    await Promise.resolve();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.sandboxes.a).toHaveLength(3);
  });
});
