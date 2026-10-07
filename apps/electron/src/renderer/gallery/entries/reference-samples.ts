export const REFERENCE_WIDTH = 952;

export const REFERENCE_GROUP = "Reference";

export const CHART_REFERENCE = {
  id: "lists-chart-reference",
  title: "Segmented, loading and chart (reference)",
  builds: { title: "Builds", icon: "sessions", loadingLabel: "Loading builds" },
  toolchain: { title: "Toolchain", loadingLabel: "Loading toolchain" },
  deviceLabel: "Device",
} as const;

export const CHIPS_REFERENCE = {
  id: "lists-chips-reference",
  title: "Chips, section and stats (reference)",
  branch: { label: "main", icon: "branch" },
  confidential: { label: "Confidential", icon: "confidential", color: "warning" },
  deviceLabel: "Device",
  progress: 0.3,
  ring: 0.62,
  avatar: "Kevin Roan",
  sphereSize: 20,
  section: { title: "Resources", subtitle: "Share of capacity", actionLabel: "View all" },
  rows: [
    ["Branch", "main"],
    ["Remote", "origin/main"],
  ],
  legend: [
    { key: "load1", label: "CPU load", color: 0, value: "12%" },
    { key: "memory", label: "Memory", color: 1, value: "" },
    { key: "load5", label: "5m load", color: 0, dash: [6, 5], value: "" },
  ],
  legendHidden: ["load5"],
  card: { title: "Alpha", subtitle: "Next.js", icon: "project", value: "3", valueLabel: "running" },
} as const;
