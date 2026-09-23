import type { SandboxResources } from "@theone/protocol";

import type { ResourceGauge } from "../types";
import { clampFraction, formatLoad, splitBytes } from "./format";

export function cpuGauge(cpu: SandboxResources["cpu"]): ResourceGauge {
  const fraction = cpu.cores > 0 ? clampFraction(cpu.load1 / cpu.cores) : 0;
  return { fraction, value: formatLoad(cpu.load1), unit: `/ ${cpu.cores} cores` };
}

export function storageGauge(usage: { usedBytes: number; totalBytes: number }): ResourceGauge {
  const used = splitBytes(usage.usedBytes);
  const total = splitBytes(usage.totalBytes);
  const fraction = usage.totalBytes > 0 ? clampFraction(usage.usedBytes / usage.totalBytes) : 0;
  return { fraction, value: used.value, unit: `${used.unit} / ${total.value} ${total.unit}` };
}
