import type { ConnectionStatus } from "../../app/connection";
import type { HistoryRange, SeriesId } from "./constants";

export const OVERVIEW_LABELS = {
  title: "Overview",
  fallbackTitle: "Sandbox",
  refresh: "Refresh",
  separator: " · ",
} as const;

export const META_LABELS = {
  uptime: (uptime: string) => `up ${uptime}`,
  version: (version: string) => `v${version}`,
} as const;

export const RESOURCE_LABELS = {
  cpu: "CPU load",
  cpuUnit: "load avg",
  cpuCaption: (cores: number, load5: string, load15: string) => `${cores} cores · 5m ${load5} · 15m ${load15}`,
  memory: "Memory",
  memoryCaption: (total: string) => `of ${total}`,
  disk: "Disk",
  diskCaption: (total: string, path: string) => `of ${total} · ${path}`,
  uptime: "Uptime",
  uptimeCaption: (started: string) => `since ${started}`,
} as const;

export const COUNT_LABELS = {
  projects: "Projects",
  runningProcesses: "Running processes",
  activeBuilds: "Active builds",
  terminals: "Terminals",
  agentRuns: "Claude runs",
} as const;

export const SECTION_LABELS = {
  resources: "Resources",
  activity: "Activity",
  display: "Display",
  tools: "Toolchain",
  toolsEmpty: "The controller reported no tools.",
} as const;

export const DISPLAY_LABELS = {
  display: "X display",
  resolution: "Resolution",
  vnc: "VNC",
  available: "Available",
  unavailable: "Unavailable",
  resolutionValue: (width: number, height: number) => `${width}×${height}`,
  displayValue: (display: string, state: string) => `${display} · ${state}`,
  vncValue: (port: number, state: string) => `Port ${port} · ${state}`,
  unknown: "—",
  missing: "not installed",
} as const;

export interface EmptyTemplate {
  title: string;
  message: string | ((error: string) => string);
  primary: string | null;
  secondary: string | null;
}

export const EMPTY_LABELS: Record<Exclude<ConnectionStatus, "online">, EmptyTemplate> = {
  unconfigured: {
    title: "Connect to your sandbox",
    message: "Start the stack with `bun run sandbox up`, then discover it or enter its URL and token.",
    primary: "Discover",
    secondary: "Preferences",
  },
  discovering: { title: "Looking for the sandbox…", message: "Asking Docker for the running controller.", primary: null, secondary: null },
  connecting: { title: "Connecting…", message: "Waiting for the controller to answer.", primary: null, secondary: null },
  offline: { title: "Sandbox unreachable", message: (error) => error, primary: "Retry", secondary: "Preferences" },
  unauthorized: {
    title: "Token rejected",
    message: "The controller refused the saved token. Rediscover it or paste a fresh one.",
    primary: "Rediscover",
    secondary: "Preferences",
  },
  incompatible: { title: "Version mismatch", message: (error) => error, primary: "Preferences", secondary: null },
};

export const ATTENTION_LABELS = {
  title: "Claude needs you",
  message: (count: string) => `${count} waiting for input or permission.`,
  session: "session",
  action: "Open Inbox",
} as const;

export const HISTORY_LABELS = {
  title: "Resource history",
  subtitle: "Share of capacity over time · CPU is load average per core",
  ranges: "Time range",
  collecting: "Collecting data…",
  now: "now",
  missing: "—",
  threshold: (value: string) => `${value} warning`,
  stats: (average: string, peak: string) => `avg ${average} · peak ${peak}`,
  statsEmpty: "No samples in range",
} as const;

export const RANGE_LABELS: Record<HistoryRange, string> = {
  "5m": "5 min",
  "15m": "15 min",
  "1h": "1 h",
};

export const SERIES_LABELS: Record<SeriesId, string> = {
  load1: "CPU load",
  memory: "Memory",
  disk: "Disk",
  load5: "5m load",
  load15: "15m load",
};

export const FORMAT_LABELS = {
  seconds: (n: number) => `${n}s`,
  minutes: (n: number) => `${n}m`,
  hours: (h: number, m: number) => (m ? `${h}h ${m}m` : `${h}h`),
  days: (d: number, h: number) => (h ? `${d}d ${h}h` : `${d}d`),
  justNow: "just now",
  minutesAgo: (n: number) => `${n}m ago`,
  hoursAgo: (n: number) => `${n}h ago`,
  daysAgo: (n: number) => `${n}d ago`,
  percent: (n: number) => `${n}%`,
} as const;
