import type { SandboxStatus } from "@tesseract/protocol";
import type { Unsubscribe } from "../../../shared/contracts/common";
import type { MetricsCache, MetricsRow } from "../../../shared/contracts/metrics";
import { METRICS, type SERIES_KEYS } from "./constants";

export type SeriesKey = (typeof SERIES_KEYS)[number];
export type SeriesPoint = [t: number, value: number | null];

export interface MetricsSample {
  t: number;
  cores: number;
  load1: number;
  load5: number;
  load15: number;
  memUsed: number;
  memTotal: number;
  diskUsed: number;
  diskTotal: number;
  gapBefore: boolean;
}

export interface SeriesStats {
  current: number | null;
  average: number | null;
  peak: number | null;
}

export interface MetricsPersistence {
  load(): Promise<MetricsCache>;
  save(cache: MetricsCache): Promise<void>;
}

export interface MetricsHistoryOptions {
  clock?: () => number;
  windowS?: number;
  persistence?: MetricsPersistence | null;
}

type Values = Omit<MetricsSample, "t" | "gapBefore">;

const VALUE_KEYS = ["cores", "load1", "load5", "load15", "memUsed", "memTotal", "diskUsed", "diskTotal"] as const satisfies readonly (keyof Values)[];

const round4 = (value: number) => Math.round(value * 10_000) / 10_000;

function isValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function sampleValue(sample: MetricsSample, key: SeriesKey): number | null {
  if (key === "memory") return sample.memTotal > 0 ? sample.memUsed / sample.memTotal : null;
  if (key === "disk") return sample.diskTotal > 0 ? sample.diskUsed / sample.diskTotal : null;
  return sample[key] / Math.max(1, sample.cores);
}

export function sampleFromStatus(status: SandboxStatus, t: number): MetricsSample | null {
  const resources = (status as Partial<SandboxStatus>).resources;
  if (!resources?.cpu || !resources.memory || !resources.disk) return null;
  const values: Values = {
    cores: resources.cpu.cores,
    load1: resources.cpu.load1,
    load5: resources.cpu.load5,
    load15: resources.cpu.load15,
    memUsed: resources.memory.usedBytes,
    memTotal: resources.memory.totalBytes,
    diskUsed: resources.disk.usedBytes,
    diskTotal: resources.disk.totalBytes,
  };
  if (!VALUE_KEYS.every((key) => isValue(values[key]) && values[key] >= 0)) return null;
  return { t, ...values, gapBefore: false };
}

export function sampleFromRow(row: unknown): MetricsSample | null {
  if (!Array.isArray(row) || row.length !== 10) return null;
  if (!row.every(isValue)) return null;
  const numbers = row as number[];
  if (numbers.slice(1, 9).some((value) => value < 0)) return null;
  const [t, cores, load1, load5, load15, memUsed, memTotal, diskUsed, diskTotal, gap] = numbers as MetricsRow;
  return { t, cores, load1, load5, load15, memUsed, memTotal, diskUsed, diskTotal, gapBefore: Boolean(gap) };
}

export function sampleToRow(sample: MetricsSample): MetricsRow {
  return [
    round4(sample.t),
    ...VALUE_KEYS.map((key) => round4(sample[key])),
    sample.gapBefore ? 1 : 0,
  ] as MetricsRow;
}

export function inWindow(samples: readonly MetricsSample[], start: number, end: number): MetricsSample[] {
  const inside = samples.filter((sample) => sample.t >= start && sample.t <= end);
  const before = samples.filter((sample) => sample.t < start).at(-1);
  const first = inside[0];
  if (before && first && !first.gapBefore && first.t - before.t <= METRICS.gapS) return [before, ...inside];
  return inside;
}

export function seriesPoints(samples: readonly MetricsSample[], key: SeriesKey): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  let previous: MetricsSample | null = null;
  for (const sample of samples) {
    if (previous && (sample.gapBefore || sample.t - previous.t > METRICS.gapS)) points.push([sample.t, null]);
    points.push([sample.t, sampleValue(sample, key)]);
    previous = sample;
  }
  return points;
}

export function seriesStats(samples: readonly MetricsSample[], key: SeriesKey, start: number): SeriesStats {
  const values = samples
    .filter((sample) => sample.t >= start)
    .map((sample) => sampleValue(sample, key))
    .filter((value): value is number => value !== null);
  if (!values.length) return { current: null, average: null, peak: null };
  return {
    current: values.at(-1) ?? null,
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    peak: Math.max(...values),
  };
}

export function samplesFromCache(cache: unknown, now: number, windowS: number = METRICS.windowS): Record<string, MetricsSample[]> {
  if (typeof cache !== "object" || cache === null) return {};
  const { version, sandboxes } = cache as Partial<MetricsCache>;
  if (version !== METRICS.version || typeof sandboxes !== "object" || sandboxes === null) return {};
  const result: Record<string, MetricsSample[]> = {};
  for (const [sandbox, rows] of Object.entries(sandboxes)) {
    if (!Array.isArray(rows)) continue;
    const samples = rows
      .map(sampleFromRow)
      .filter((sample): sample is MetricsSample => sample !== null && now - windowS <= sample.t && sample.t <= now + METRICS.futureToleranceS)
      .sort((a, b) => a.t - b.t)
      .slice(-METRICS.maxSamples);
    if (samples.length) result[sandbox] = samples;
  }
  return result;
}

export function cacheFromSamples(
  sandboxes: Record<string, readonly MetricsSample[]>,
  now: number,
  windowS: number = METRICS.windowS,
): MetricsCache {
  const kept = Object.entries(sandboxes)
    .map(([sandbox, samples]) => [sandbox, samples.filter((sample) => sample.t >= now - windowS).slice(-METRICS.maxSamples).map(sampleToRow)] as const)
    .filter(([, rows]) => rows.length > 0)
    .sort(([, a], [, b]) => (b.at(-1)?.[0] ?? 0) - (a.at(-1)?.[0] ?? 0))
    .slice(0, METRICS.maxSandboxes);
  return { version: METRICS.version, sandboxes: Object.fromEntries(kept) };
}

export class MetricsHistory {
  private samplesList: MetricsSample[] = [];
  private sandbox: string | null = null;
  private broken = true;
  private stored: Record<string, MetricsSample[]> = {};
  private lastSave: number;
  private revisionValue = 0;
  private readonly listeners = new Set<(revision: number) => void>();
  private readonly clock: () => number;
  private readonly windowS: number;
  private readonly persistence: MetricsPersistence | null;

  constructor(options: MetricsHistoryOptions = {}) {
    this.clock = options.clock ?? (() => Date.now() / 1000);
    this.windowS = options.windowS ?? METRICS.windowS;
    this.persistence = options.persistence ?? null;
    this.lastSave = this.clock();
  }

  get sandboxId(): string | null {
    return this.sandbox;
  }

  get samples(): readonly MetricsSample[] {
    return this.samplesList;
  }

  get revision(): number {
    return this.revisionValue;
  }

  now(): number {
    return this.clock();
  }

  async hydrate(): Promise<void> {
    if (!this.persistence) return;
    const cache = await this.persistence.load().catch(() => null);
    this.hydrateFrom(cache);
  }

  hydrateFrom(cache: unknown): void {
    const now = this.clock();
    const loaded = samplesFromCache(cache, now, this.windowS);
    this.stored = { ...loaded, ...this.stored };
    const earlier = this.sandbox === null ? [] : (loaded[this.sandbox] ?? []);
    const first = this.samplesList[0];
    const older = earlier.filter((sample) => sample.t >= now - this.windowS && (!first || sample.t < first.t));
    if (!older.length) return;
    this.samplesList = first ? [...older, { ...first, gapBefore: true }, ...this.samplesList.slice(1)] : older;
    if (!first) this.broken = true;
    this.bump();
  }

  subscribe(listener: (revision: number) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  slice(rangeS: number, end: number = this.clock()): MetricsSample[] {
    return inWindow(this.samplesList, end - rangeS, end);
  }

  markBreak(): void {
    this.broken = true;
  }

  record(status: SandboxStatus): void {
    const now = this.clock();
    const sample = sampleFromStatus(status, now);
    if (!sample) return;
    const sandbox = status.sandboxId || "";
    if (sandbox !== this.sandbox) this.switchTo(sandbox, now);
    while (this.samplesList.length && (this.samplesList.at(-1)?.t ?? 0) >= now) {
      this.samplesList.pop();
      this.broken = true;
    }
    this.samplesList.push({ ...sample, gapBefore: this.broken && this.samplesList.length > 0 });
    this.broken = false;
    this.prune(now);
    this.bump();
    if (now - this.lastSave >= METRICS.saveIntervalS) void this.save();
  }

  snapshot(): MetricsCache {
    const now = this.clock();
    if (this.sandbox !== null) this.stored[this.sandbox] = [...this.samplesList];
    return cacheFromSamples(this.stored, now, this.windowS);
  }

  async save(): Promise<void> {
    if (!this.persistence) return;
    this.lastSave = this.clock();
    await this.persistence.save(this.snapshot()).catch(() => undefined);
  }

  private switchTo(sandbox: string, now: number): void {
    if (this.sandbox !== null) this.stored[this.sandbox] = [...this.samplesList];
    this.sandbox = sandbox;
    this.samplesList = (this.stored[sandbox] ?? []).filter((sample) => sample.t >= now - this.windowS);
    this.broken = true;
  }

  private prune(now: number): void {
    const cutoff = now - this.windowS - METRICS.gapS;
    const index = this.samplesList.findIndex((sample) => sample.t >= cutoff);
    if (index > 0) this.samplesList = this.samplesList.slice(index);
    else if (index === -1) this.samplesList = [];
    if (this.samplesList.length > METRICS.maxSamples) this.samplesList = this.samplesList.slice(-METRICS.maxSamples);
  }

  private bump(): void {
    this.revisionValue += 1;
    this.listeners.forEach((listener) => listener(this.revisionValue));
  }
}
