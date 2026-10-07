import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MetricsCache, MetricsRow } from "../../shared/contracts/metrics";

export const METRICS_FILE = "metrics.json";
export const METRICS_WINDOW_S = 3600;
export const METRICS_MAX_ROWS = 1500;
export const METRICS_MAX_SANDBOXES = 4;
export const METRICS_FUTURE_TOLERANCE_S = 60;
const ROW_LENGTH = 10;
const ROUND_DIGITS = 4;

export const EMPTY_METRICS: MetricsCache = { version: 1, sandboxes: {} };

function validRow(row: unknown): row is MetricsRow {
  if (!Array.isArray(row) || row.length !== ROW_LENGTH) return false;
  if (!row.every((value) => typeof value === "number" && Number.isFinite(value))) return false;
  return row.slice(1, 9).every((value) => (value as number) >= 0);
}

function normalizeRow(row: MetricsRow): MetricsRow {
  const round = (value: number) => Number(value.toFixed(ROUND_DIGITS));
  return [...row.slice(0, 9).map(round), row[9] ? 1 : 0] as MetricsRow;
}

export function parseMetrics(text: string, nowS: number, windowS: number = METRICS_WINDOW_S): MetricsCache {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return EMPTY_METRICS;
  }
  const record = data as Partial<MetricsCache> | null;
  if (!record || record.version !== 1 || typeof record.sandboxes !== "object" || record.sandboxes === null) return EMPTY_METRICS;
  const sandboxes: Record<string, MetricsRow[]> = {};
  for (const [sandbox, rows] of Object.entries(record.sandboxes as Record<string, unknown>)) {
    if (!Array.isArray(rows)) continue;
    const kept = rows
      .filter(validRow)
      .filter((row) => row[0] >= nowS - windowS && row[0] <= nowS + METRICS_FUTURE_TOLERANCE_S)
      .map(normalizeRow)
      .sort((a, b) => a[0] - b[0])
      .slice(-METRICS_MAX_ROWS);
    if (kept.length > 0) sandboxes[sandbox] = kept;
  }
  return { version: 1, sandboxes };
}

export function serializeMetrics(cache: MetricsCache, nowS: number, windowS: number = METRICS_WINDOW_S): string {
  const kept = Object.entries(cache.sandboxes ?? {})
    .map(([sandbox, rows]) => [sandbox, rows.filter(validRow).filter((row) => row[0] >= nowS - windowS).map(normalizeRow).slice(-METRICS_MAX_ROWS)] as const)
    .filter(([, rows]) => rows.length > 0)
    .sort((a, b) => (b[1].at(-1)?.[0] ?? 0) - (a[1].at(-1)?.[0] ?? 0))
    .slice(0, METRICS_MAX_SANDBOXES);
  return JSON.stringify({ version: 1, sandboxes: Object.fromEntries(kept) });
}

export async function loadMetrics(cacheDir: string, nowS: number): Promise<MetricsCache> {
  try {
    return parseMetrics(await readFile(join(cacheDir, METRICS_FILE), "utf8"), nowS);
  } catch {
    return EMPTY_METRICS;
  }
}

export async function saveMetrics(cacheDir: string, cache: MetricsCache, nowS: number): Promise<void> {
  const file = join(cacheDir, METRICS_FILE);
  const temp = `${file}.tmp`;
  await mkdir(cacheDir, { recursive: true });
  await writeFile(temp, serializeMetrics(cache, nowS), "utf8");
  await rename(temp, file);
}
