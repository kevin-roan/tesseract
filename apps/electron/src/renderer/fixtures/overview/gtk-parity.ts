import type { SandboxStatus } from "@theone/protocol";
import type { MetricsCache, MetricsRow } from "../../../shared/contracts/metrics";
import { FIXTURE_SANDBOX } from "../base/data";
import { GTK_PARITY_NOW, parityVariant } from "../shell/parity";
import { overviewStatus } from "./data";

const GIB = 1024 ** 3;
const DISK_TOTAL_GIB = 100.2;
const CORES = 4;
const STEP_S = 5;
const HISTORY_ANCHOR_S = GTK_PARITY_NOW / 1000 + 21;
const HISTORY_FIRST_AGE_S = 1020;
const BOOTED_AT_S = Date.parse("2026-10-06T15:31:31.000Z") / 1000;

interface ParityReading {
  load1: number;
  load5: number;
  load15: number;
  memGb: number;
  diskGb: number;
}

const READINGS: Readonly<Record<string, ParityReading>> = {
  shell: { load1: 4.93, load5: 5.41, load15: 3.92, memGb: 4.53, diskGb: 81.6 },
  "shell-light": { load1: 4.52, load5: 5.29, load15: 3.88, memGb: 4.62, diskGb: 81.7 },
  overview: { load1: 11.99, load5: 6.85, load15: 4.47, memGb: 6.3, diskGb: 81.8 },
  "overview-light": { load1: 28.44, load5: 11.34, load15: 6.04, memGb: 5.9, diskGb: 81.9 },
  pair: { load1: 22.1, load5: 7.36, load15: 4.9, memGb: 5.6, diskGb: 81.9 },
  "pair-host": { load1: 29.21, load5: 11.76, load15: 6.2, memGb: 5.78, diskGb: 81.9 },
};

const DEFAULT_READING = "shell";

function reading(): ParityReading {
  return READINGS[parityVariant() ?? DEFAULT_READING] ?? READINGS[DEFAULT_READING]!;
}

export function parityStatus(): SandboxStatus {
  const now = Date.now();
  const r = reading();
  const base = overviewStatus(now);
  const uptimeSec = Math.floor(now / 1000 - BOOTED_AT_S);
  return {
    ...base,
    startedAt: new Date(BOOTED_AT_S * 1000).toISOString(),
    uptimeSec,
    resources: {
      cpu: { cores: CORES, load1: r.load1, load5: r.load5, load15: r.load15 },
      memory: { totalBytes: 8 * GIB, usedBytes: Math.round(r.memGb * GIB) },
      disk: { path: "/workspace", totalBytes: Math.round(DISK_TOTAL_GIB * GIB), usedBytes: Math.round(r.diskGb * GIB) },
    },
  };
}

function historyShare(series: readonly number[], t: number, current: number): number {
  const index = (t - (HISTORY_ANCHOR_S - HISTORY_FIRST_AGE_S)) / STEP_S;
  const last = series.length - 1;
  if (index <= 0) return series[0]! / 100;
  if (index <= last) return series[Math.round(index)]! / 100;
  const end = HISTORY_ANCHOR_S - HISTORY_FIRST_AGE_S + last * STEP_S;
  const span = Date.now() / 1000 - end;
  const progress = span > 0 ? Math.min(1, (t - end) / span) : 1;
  return series[last]! / 100 + (current - series[last]! / 100) * progress;
}

export function parityMetricsCache(): MetricsCache {
  const nowS = Date.now() / 1000;
  const r = reading();
  const memTotal = 8 * GIB;
  const rows: MetricsRow[] = [];
  for (let t = HISTORY_ANCHOR_S - HISTORY_FIRST_AGE_S; t < nowS - STEP_S / 2; t += STEP_S) {
    const load1 = historyShare(PARITY_CPU_PERCENT, t, r.load1 / CORES) * CORES;
    const memUsed = historyShare(PARITY_MEMORY_PERCENT, t, (r.memGb * GIB) / memTotal) * memTotal;
    rows.push([t, CORES, load1, r.load5, r.load15, memUsed, memTotal, r.diskGb * GIB, DISK_TOTAL_GIB * GIB, 0]);
  }
  return { version: 1, sandboxes: { [FIXTURE_SANDBOX]: rows } };
}

export const PARITY_CPU_PERCENT = [
  45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 44,
  40, 37, 34, 32, 32, 32, 33, 31, 32, 34, 32, 32, 38, 41, 40, 42, 46, 49, 51, 51, 53, 53, 52, 53, 57, 63, 65, 66, 69,
  65, 65, 65, 61, 56, 56, 60, 60, 59, 60, 57, 55, 55, 55, 56, 55, 58, 62, 66, 71, 90, 117, 122, 129, 141, 151, 148,
  147, 152, 153, 152, 149, 145, 138, 137, 135, 130, 131, 124, 117, 108, 100, 96, 90, 85, 82, 78, 74, 70, 66, 66, 75,
  81, 128, 163, 152, 145, 141, 134, 134, 129, 122, 113, 104, 96, 91, 91, 96, 104, 114, 123, 129, 130, 126, 121, 114,
  108, 104, 102, 102, 100, 100, 100, 100, 101, 107, 117, 129, 141, 151, 156, 158, 160, 160, 163, 166, 173, 187, 206,
  227, 246, 258, 260, 258, 255, 250, 244, 238, 231, 223, 212, 202, 192, 187, 185, 188, 192, 197, 201, 205, 206, 202,
  194, 186, 176, 167, 161, 156, 150, 146, 142, 140, 140, 140, 140, 140, 140, 140, 140, 139, 137, 133, 129, 125, 123,
  123,
] as const;

export const PARITY_MEMORY_PERCENT = [
  9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9,
  11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 13, 13, 13, 12, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11,
  11, 11, 11, 11, 11, 11, 11, 13, 13, 13, 14, 14, 12, 15, 17, 19, 20, 23, 28, 28, 28, 30, 30, 30, 28, 28, 28, 30, 30,
  30, 30, 30, 30, 30, 30, 30, 30, 30, 31, 32, 32, 32, 32, 32, 32, 32, 30, 30, 30, 30, 30, 30, 30, 31, 31, 31, 31, 31,
  32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 31, 30, 30, 30, 30, 30, 30, 32, 34, 36, 37, 38, 40, 40, 42, 42, 42,
  42, 42, 42, 42, 40, 40, 40, 40, 41, 42, 42, 42, 43, 43, 45, 45, 45, 47, 47, 47, 49, 49, 49, 49, 51, 51, 51, 51, 51,
  51, 51, 51, 51, 51, 51, 53, 53, 53, 54, 55, 55, 56, 57, 57, 57, 57, 57, 57, 57, 57,
] as const;
