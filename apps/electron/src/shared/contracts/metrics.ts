import type { DefineContract } from "../ipc-types";

export type MetricsRow = [
  t: number,
  cores: number,
  load1: number,
  load5: number,
  load15: number,
  memUsed: number,
  memTotal: number,
  diskUsed: number,
  diskTotal: number,
  gap: 0 | 1,
];

export interface MetricsCache {
  version: 1;
  sandboxes: Record<string, MetricsRow[]>;
}

export type MetricsContract = DefineContract<{
  methods: {
    load(): MetricsCache;
    save(cache: MetricsCache): void;
  };
  events: Record<never, never>;
}>;
