import type { SandboxStatus } from "@tesseract/protocol";
import { sampleDisplay, sampleStatus } from "@tesseract/protocol/fixtures";
import type { MetricsCache, MetricsRow } from "../../../shared/contracts/metrics";
import { FIXTURE_SANDBOX } from "../base/data";

const GIB = 1024 ** 3;
const MINUTE = 60;

export const OVERVIEW_FIXTURE = {
  cores: 4,
  load1: 11.99,
  load5: 6.85,
  load15: 4.47,
  memTotal: 8 * GIB,
  memUsed: Math.round(6.3 * GIB),
  diskTotal: 100 * GIB,
  diskUsed: Math.round(81.8 * GIB),
  uptimeSec: 7 * 3600 + 46 * MINUTE,
  historyS: 20 * MINUTE,
  stepS: 5,
  version: 1,
} as const;

export const OVERVIEW_TOOLS: SandboxStatus["tools"] = [
  { name: "node", version: "24.1.0" },
  { name: "bun", version: "1.3.4" },
  { name: "java", version: "21.0.8" },
  { name: "flutter", version: "3.35.4" },
  { name: "android-sdk", version: "36.0.0" },
  { name: "wine", version: "10.0" },
  { name: "claude", version: "2.1.3" },
  { name: "whisper", version: null },
];

export function overviewStatus(now: number = Date.now(), tools: SandboxStatus["tools"] = OVERVIEW_TOOLS): SandboxStatus {
  const f = OVERVIEW_FIXTURE;
  return {
    ...sampleStatus,
    sandboxId: FIXTURE_SANDBOX,
    hostname: FIXTURE_SANDBOX,
    version: "0.1.0",
    startedAt: new Date(now - f.uptimeSec * 1000).toISOString(),
    uptimeSec: f.uptimeSec,
    resources: {
      cpu: { cores: f.cores, load1: f.load1, load5: f.load5, load15: f.load15 },
      memory: { totalBytes: f.memTotal, usedBytes: f.memUsed },
      disk: { path: "/workspace", totalBytes: f.diskTotal, usedBytes: f.diskUsed },
    },
    display: sampleDisplay,
    tools,
    counts: { projects: 4, runningProcesses: 1, activeBuilds: 0, terminals: 2, agentRuns: 0 },
  };
}

type Keyframes = readonly (readonly [minutesAgo: number, share: number])[];

const CPU_KEYFRAMES: Keyframes = [
  [20, 0.3], [15.2, 0.33], [14.3, 0.4], [13.2, 0.55], [12.0, 0.6], [11.8, 0.68], [11.6, 1.1], [11.4, 1.48],
  [11.0, 1.55], [10.6, 1.48], [10.2, 1.1], [9.8, 0.85], [9.3, 0.72], [9.0, 0.68], [8.9, 1.65], [8.5, 1.42],
  [8.1, 0.98], [7.8, 1.02], [7.4, 1.22], [7.1, 1.02], [6.7, 0.98], [6.3, 1.02], [5.9, 1.6], [5.4, 1.78],
  [5.0, 2.48], [4.8, 2.62], [4.4, 2.35], [4.0, 1.85], [3.6, 2.05], [3.2, 1.7], [2.6, 1.42], [2.0, 1.4],
  [1.3, 1.2], [0.8, 1.3], [0.4, 1.9], [0, 2.3],
];

const MEMORY_KEYFRAMES: Keyframes = [
  [20, 0.08], [15, 0.1], [11.5, 0.15], [9, 0.3], [6.5, 0.32], [5, 0.45], [2.5, 0.53], [0, 0.56],
];

function interpolate(frames: Keyframes, minutesAgo: number): number {
  const next = frames.findIndex(([at]) => at <= minutesAgo);
  if (next <= 0) return frames[Math.max(0, next)]![1];
  const [a, va] = frames[next - 1]!;
  const [b, vb] = frames[next]!;
  const p = (a - minutesAgo) / (a - b);
  const eased = p * p * (3 - 2 * p);
  return va + (vb - va) * eased;
}

export function cpuShare(minutesAgo: number): number {
  const noise = 0.02 * Math.sin(minutesAgo * 41) + 0.012 * Math.sin(minutesAgo * 97 + 1.3);
  return Math.max(0.05, interpolate(CPU_KEYFRAMES, minutesAgo) + noise);
}

export function overviewMetricsCache(nowS: number = Date.now() / 1000): MetricsCache {
  const f = OVERVIEW_FIXTURE;
  const count = Math.floor(f.historyS / f.stepS);
  const rows: MetricsRow[] = Array.from({ length: count }, (_, index) => {
    const progress = index / (count - 1);
    const t = nowS - f.historyS + index * f.stepS - f.stepS;
    const minutesAgo = (nowS - t) / MINUTE;
    const load1 = cpuShare(minutesAgo) * f.cores;
    const load5 = (0.6 + 1.1 * progress) * f.cores;
    const load15 = (0.5 + 0.62 * progress) * f.cores;
    const memory = (interpolate(MEMORY_KEYFRAMES, minutesAgo) + 0.004 * Math.sin(progress * 23)) * f.memTotal;
    return [t, f.cores, load1, load5, load15, memory, f.memTotal, f.diskUsed, f.diskTotal, 0];
  });
  return { version: f.version, sandboxes: { [FIXTURE_SANDBOX]: rows } };
}

export const EMPTY_METRICS: MetricsCache = { version: 1, sandboxes: {} };
