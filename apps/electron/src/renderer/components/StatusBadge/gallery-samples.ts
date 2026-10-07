import type { StatusBadgeProps } from "./StatusBadge";

export const BADGE_SAMPLES: StatusBadgeProps[] = [
  { label: "Online", tone: "success" },
  { label: "Running", tone: "info", live: true },
  { label: "Needs you", tone: "warning" },
  { label: "Failed", tone: "danger", icon: "failed" },
  { label: "Cancelled", tone: "neutral" },
];
