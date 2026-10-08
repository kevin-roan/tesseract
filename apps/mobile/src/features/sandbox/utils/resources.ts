import type { SandboxResources } from "@tesseract/protocol";

import type { ResourceGauge } from "../types";
import { clampFraction, formatBytes, formatLoad, splitBytes } from "./format";

export function cpuGauge(cpu: SandboxResources["cpu"]): ResourceGauge {
  const fraction = cpu.cores > 0 ? clampFraction(cpu.load1 / cpu.cores) : 0;
  return {
    fraction,
    value: formatLoad(cpu.load1),
    unit: "load avg",
    caption: `${cpu.cores} cores · 5m ${formatLoad(cpu.load5)} · 15m ${formatLoad(cpu.load15)}`,
  };
}

export function storageGauge(usage: { usedBytes: number; totalBytes: number; path?: string }): ResourceGauge {
  const used = splitBytes(usage.usedBytes);
  const fraction = usage.totalBytes > 0 ? clampFraction(usage.usedBytes / usage.totalBytes) : 0;
  const caption = [`of ${formatBytes(usage.totalBytes)}`, usage.path].filter(Boolean).join(" · ");
  return { fraction, value: used.value, unit: used.unit, caption };
}
