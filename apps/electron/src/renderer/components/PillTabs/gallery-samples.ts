import type { PillTab } from "./types";

export const PILL_TABS_SAMPLE: readonly PillTab[] = [
  { id: "all", label: "All projects" },
  { id: "active", label: "Active", count: 3 },
  { id: "idle", label: "Idle", count: 0 },
];

export const PILL_TABS_SAMPLE_LABEL = "Projects filter";
export const PILL_TABS_SAMPLE_DEFAULT = "all";
