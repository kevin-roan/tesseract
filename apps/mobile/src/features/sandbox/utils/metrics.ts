import type { SandboxStatus } from "@theone/protocol";

import type { ChartPoint } from "@/components/time-series-chart";

export type MetricKey = "load1" | "load5" | "load15" | "memory" | "disk";

export type MetricSample = {
  t: number;
  cores: number;
  load1: number;
  load5: number;
  load15: number;
  memUsed: number;
  memTotal: number;
  diskUsed: number;
  diskTotal: number;
};

export type MetricStats = {
  current: number | null;
  average: number | null;
  peak: number | null;
};

export const HISTORY_WINDOW_MS = 60 * 60_000;
/** Two samples further apart than this are not joined; the app was closed or the sandbox unreachable. */
export const HISTORY_GAP_MS = 95_000;
export const HISTORY_MAX_SAMPLES = 1500;
export const HISTORY_MAX_SANDBOXES = 4;

const SAMPLE_FIELDS = ["t", "cores", "load1", "load5", "load15", "memUsed", "memTotal", "diskUsed", "diskTotal"] as const;

const round = (value: number) => Math.round(value * 10_000) / 10_000;

export function sampleFromStatus(status: SandboxStatus, t: number): MetricSample | null {
  const { cpu, memory, disk } = status.resources;
  const sample: MetricSample = {
    t,
    cores: cpu.cores,
    load1: round(cpu.load1),
    load5: round(cpu.load5),
    load15: round(cpu.load15),
    memUsed: memory.usedBytes,
    memTotal: memory.totalBytes,
    diskUsed: disk.usedBytes,
    diskTotal: disk.totalBytes,
  };
  return isSample(sample) ? sample : null;
}

export function isSample(value: unknown): value is MetricSample {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return SAMPLE_FIELDS.every((field) => {
    const entry = record[field];
    return typeof entry === "number" && Number.isFinite(entry) && entry >= 0;
  });
}

export function sampleValue(sample: MetricSample, key: MetricKey): number | null {
  switch (key) {
    case "load1":
    case "load5":
    case "load15":
      return sample[key] / Math.max(1, sample.cores);
    case "memory":
      return sample.memTotal > 0 ? sample.memUsed / sample.memTotal : null;
    case "disk":
      return sample.diskTotal > 0 ? sample.diskUsed / sample.diskTotal : null;
  }
}

/** Keeps samples sorted, drops anything older than the window and caps the count. */
export function appendSample(samples: readonly MetricSample[], sample: MetricSample): MetricSample[] {
  const cutoff = sample.t - HISTORY_WINDOW_MS - HISTORY_GAP_MS;
  const kept = samples.filter((entry) => entry.t >= cutoff && entry.t < sample.t);
  return [...kept, sample].slice(-HISTORY_MAX_SAMPLES);
}

export function mergeSamples(a: readonly MetricSample[], b: readonly MetricSample[], now: number): MetricSample[] {
  const byTime = new Map<number, MetricSample>();
  for (const sample of [...a, ...b]) {
    if (isSample(sample) && sample.t >= now - HISTORY_WINDOW_MS) byTime.set(sample.t, sample);
  }
  return [...byTime.values()].sort((x, y) => x.t - y.t).slice(-HISTORY_MAX_SAMPLES);
}

/** The most recently sampled sandboxes, so stale pairings do not grow the store forever. */
export function trimSandboxes(
  history: Record<string, MetricSample[]>,
  limit: number = HISTORY_MAX_SANDBOXES,
): Record<string, MetricSample[]> {
  const entries = Object.entries(history)
    .filter(([, samples]) => samples.length > 0)
    .sort(([, a], [, b]) => (b.at(-1)?.t ?? 0) - (a.at(-1)?.t ?? 0))
    .slice(0, limit);
  return Object.fromEntries(entries);
}

/** Samples inside the range, plus the one just before it so the line reaches the left edge. */
export function samplesInWindow(samples: readonly MetricSample[], start: number, end: number): MetricSample[] {
  const inside = samples.filter((sample) => sample.t >= start && sample.t <= end);
  const before = samples.filter((sample) => sample.t < start).at(-1);
  const first = inside[0];
  if (before && first && first.t - before.t <= HISTORY_GAP_MS) return [before, ...inside];
  return inside;
}

export function seriesPoints(samples: readonly MetricSample[], key: MetricKey): ChartPoint[] {
  const points: ChartPoint[] = [];
  samples.forEach((sample, index) => {
    const previous = samples[index - 1];
    if (previous && sample.t - previous.t > HISTORY_GAP_MS) points.push({ t: sample.t, value: null });
    points.push({ t: sample.t, value: sampleValue(sample, key) });
  });
  return points;
}

export function seriesStats(samples: readonly MetricSample[], key: MetricKey, start: number): MetricStats {
  const values = samples
    .filter((sample) => sample.t >= start)
    .map((sample) => sampleValue(sample, key))
    .filter((value): value is number => value !== null);
  if (values.length === 0) return { current: null, average: null, peak: null };
  return {
    current: values[values.length - 1],
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    peak: Math.max(...values),
  };
}
