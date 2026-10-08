import type { SandboxStatus } from "@tesseract/protocol";
import type { ConnectionStatus, SeriesKey } from "../../app/connection";
import type { PageId } from "../../../shared/routes";
import type { IconName } from "../../theme/icons";

export type HistoryRange = "5m" | "15m" | "1h";
export type SeriesId = SeriesKey;
export type CountKey = keyof SandboxStatus["counts"];
export type EmptyAction = "rediscover" | "retry" | "preferences";

export const LOAD_WARNING = 0.85;
export const HISTORY_RANGES: readonly HistoryRange[] = ["5m", "15m", "1h"];
export const HISTORY_RANGE_S: Record<HistoryRange, number> = { "5m": 300, "15m": 900, "1h": 3600 };
export const DEFAULT_RANGE: HistoryRange = "15m";
export const CHART_HEIGHT = 200;
export const PERCENT_SCALE = 100;
export const LOAD_DIGITS = 2;

export const RESOURCE_ICONS = {
  cpu: "cpu",
  memory: "memory",
  disk: "disk",
  uptime: "uptime",
} as const satisfies Record<string, IconName>;

export const COUNT_KEYS: readonly CountKey[] = ["projects", "runningProcesses", "activeBuilds", "terminals", "agentRuns"];

export const COUNT_ICONS: Record<CountKey, IconName> = {
  projects: "projects",
  runningProcesses: "processes",
  activeBuilds: "builds",
  terminals: "terminal",
  agentRuns: "agents",
};

export interface CountTarget {
  page: PageId;
  params?: Record<string, unknown>;
}

export const COUNT_TARGETS: Record<CountKey, CountTarget> = {
  projects: { page: "projects" },
  runningProcesses: { page: "terminals" },
  activeBuilds: { page: "files", params: { view: "builds" } },
  terminals: { page: "terminals" },
  agentRuns: { page: "agents" },
};

export const INBOX_TARGET: CountTarget = { page: "agents" };

export const EMPTY_ICONS: Partial<Record<ConnectionStatus, IconName>> = {
  unconfigured: "sandbox",
  offline: "offline",
  unauthorized: "warning",
  incompatible: "warning",
};

export const LOADING_STATUSES: readonly ConnectionStatus[] = ["discovering", "connecting"];

export const EMPTY_ACTIONS: Partial<Record<ConnectionStatus, readonly [primary: EmptyAction | null, secondary: EmptyAction | null]>> = {
  unconfigured: ["rediscover", "preferences"],
  offline: ["retry", "preferences"],
  unauthorized: ["rediscover", "preferences"],
  incompatible: ["preferences", null],
};

export interface SeriesSpec {
  key: SeriesId;
  color: number;
  fill?: boolean;
  dash?: readonly number[];
  visible: boolean;
}

export const SERIES_SPECS: readonly SeriesSpec[] = [
  { key: "load1", color: 0, fill: true, visible: true },
  { key: "memory", color: 1, visible: true },
  { key: "disk", color: 2, visible: true },
  { key: "load5", color: 0, dash: [6, 5], visible: false },
  { key: "load15", color: 0, dash: [0.1, 5], visible: false },
];

export const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;
export const BYTE_STEP = 1024;

export const TIME_S = {
  minute: 60,
  hour: 3600,
  day: 86_400,
  week: 604_800,
  justNow: 45,
} as const;

export const RESOURCE_GRID = {
  wide: 4,
  narrow: 2,
  minTile: 150,
  gap: 8,
} as const;
