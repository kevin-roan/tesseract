import type { SegmentOption } from "./SegmentedControl";

export const DEVICE_SEGMENTS: readonly SegmentOption<"phone" | "desktop">[] = [
  { id: "phone", label: "Phone" },
  { id: "desktop", label: "Desktop" },
];

export const PAIR_SEGMENTS: readonly SegmentOption<"sandbox" | "host">[] = [
  { id: "sandbox", label: "Sandbox" },
  { id: "host", label: "This computer" },
];

export const SEGMENTED_GALLERY_LABELS = {
  device: "Device",
  pair: "Pair a device",
} as const;
