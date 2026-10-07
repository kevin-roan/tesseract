import type { ChipOption } from "./types";

export const CHIP_RANGE_OPTIONS: readonly ChipOption[] = [
  { id: "15m", label: "15m" },
  { id: "1h", label: "1h" },
  { id: "6h", label: "6h" },
  { id: "24h", label: "24h", disabled: true },
];

export const CHIP_KIT_OPTIONS: readonly ChipOption[] = [
  { id: "android", label: "Android", icon: "smartphone" },
  { id: "web", label: "Web", icon: "browser" },
  { id: "desktop", label: "Desktop", icon: "app-window" },
];

export const CHIP_SAMPLES = {
  group: "Range",
  kit: "Platform",
  toggle: "Shared",
  property: "Confidential",
  filter: "Running",
  suggestion: "Fix the failing build",
  captionGroup: "ChipGroup",
  captionKinds: "Toggle / property / filter / suggestion",
} as const;
