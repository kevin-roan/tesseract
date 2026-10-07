import type { StatItem } from "./types";

export const STAT_SAMPLES: StatItem[] = [
  { id: "cpu", icon: "cpu", label: "CPU load", value: "0.42", unit: "load avg", progress: 0.21, caption: "8 cores · 5m 0.3" },
  { id: "memory", icon: "memory", label: "Memory", value: "3.1 GB", progress: 0.9, tone: "violet", caption: "of 16 GB" },
];

const noop = () => undefined;

const GRID_ITEMS: StatItem[] = [
  ...STAT_SAMPLES,
  { id: "disk", icon: "disk", label: "Disk", value: "41 GB", progress: 0.45, caption: "of 92 GB · /workspace" },
  { id: "uptime", icon: "uptime", label: "Uptime", value: "3d 4h", caption: "since Oct 4, 09:12" },
];

export const STAT_GRID_SAMPLES: StatItem[] = GRID_ITEMS.map((item) => ({ ...item, onActivate: noop }));
