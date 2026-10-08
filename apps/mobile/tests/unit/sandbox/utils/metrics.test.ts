import { sampleStatus } from "@tesseract/protocol/fixtures";

import {
  appendSample,
  HISTORY_GAP_MS,
  HISTORY_WINDOW_MS,
  mergeSamples,
  sampleFromStatus,
  samplesInWindow,
  sampleValue,
  seriesPoints,
  seriesStats,
  trimSandboxes,
  type MetricSample,
} from "@/features/sandbox/utils/metrics";

const sample = (t: number, load1 = 1): MetricSample => ({
  t,
  cores: 4,
  load1,
  load5: 2,
  load15: 0,
  memUsed: 1,
  memTotal: 4,
  diskUsed: 0,
  diskTotal: 0,
});

describe("metric samples", () => {
  it("reads a status into a sample and normalises values to capacity", () => {
    const reading = sampleFromStatus(sampleStatus, 1000);
    expect(reading).not.toBeNull();
    expect(reading?.t).toBe(1000);
    expect(sampleValue(sample(0), "load1")).toBe(0.25);
    expect(sampleValue(sample(0), "load5")).toBe(0.5);
    expect(sampleValue(sample(0), "memory")).toBe(0.25);
    expect(sampleValue(sample(0), "disk")).toBeNull();
  });

  it("rejects readings with invalid numbers", () => {
    const broken = { ...sampleStatus, resources: { ...sampleStatus.resources, cpu: { ...sampleStatus.resources.cpu, load1: Number.NaN } } };
    expect(sampleFromStatus(broken, 0)).toBeNull();
  });

  it("appends in order and prunes old or out-of-order samples", () => {
    const now = HISTORY_WINDOW_MS * 2;
    const old = sample(now - HISTORY_WINDOW_MS - HISTORY_GAP_MS - 1);
    const kept = sample(now - 1000);
    const future = sample(now + 5000);
    expect(appendSample([old, kept, future], sample(now)).map((entry) => entry.t)).toEqual([now - 1000, now]);
  });

  it("merges stored and fresh samples by time", () => {
    const now = HISTORY_WINDOW_MS;
    const merged = mergeSamples([sample(10), sample(20)], [sample(20, 3), sample(15)], now);
    expect(merged.map((entry) => entry.t)).toEqual([10, 15, 20]);
    expect(merged[2].load1).toBe(3);
    expect(mergeSamples([{ t: 1 } as MetricSample], [], now)).toEqual([]);
  });

  it("keeps only the most recently sampled sandboxes", () => {
    const trimmed = trimSandboxes({ a: [sample(1)], b: [sample(3)], c: [sample(2)], d: [] }, 2);
    expect(Object.keys(trimmed)).toEqual(["b", "c"]);
  });
});

describe("metric series", () => {
  it("includes the sample just before the window when it is close enough", () => {
    const samples = [sample(0), sample(10_000), sample(20_000)];
    expect(samplesInWindow(samples, 15_000, 30_000).map((entry) => entry.t)).toEqual([10_000, 20_000]);
    expect(samplesInWindow([sample(0), sample(HISTORY_GAP_MS + 20_000)], 10_000, HISTORY_GAP_MS + 30_000)).toHaveLength(1);
  });

  it("breaks the line across gaps", () => {
    const points = seriesPoints([sample(0), sample(10_000), sample(10_000 + HISTORY_GAP_MS + 1)], "load1");
    expect(points.map((point) => point.value)).toEqual([0.25, 0.25, null, 0.25]);
  });

  it("summarises current, average and peak inside the range", () => {
    const samples = [sample(0, 4), sample(10, 2), sample(20, 1)];
    expect(seriesStats(samples, "load1", 5)).toEqual({ current: 0.25, average: 0.375, peak: 0.5 });
    expect(seriesStats(samples, "disk", 0)).toEqual({ current: null, average: null, peak: null });
  });
});
