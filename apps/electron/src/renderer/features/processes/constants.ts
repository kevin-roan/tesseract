import type { Tone } from "../../theme/colors";
import type { IconName } from "../../theme/icons";
import type { ConnectionStatus } from "../../app/connection";
import type { ProcessGroupId } from "./types";

export const PROCESS_GROUPS = ["process", "app-run", "agent-run", "terminal", "browser", "vnc", "emulator"] as const satisfies readonly ProcessGroupId[];

export const GROUP_ICONS: Record<ProcessGroupId, IconName> = {
  process: "cpu",
  "app-run": "play",
  "agent-run": "agents",
  terminal: "terminal",
  browser: "browser",
  vnc: "display",
  emulator: "smartphone",
};

export const STATE_TONES: Record<string, Tone> = {
  running: "success",
  starting: "info",
  stopping: "warning",
  waiting: "warning",
  failed: "danger",
};

export const LIVE_STATES: readonly string[] = ["running", "starting"];
export const HOST_DEVICE_ACTIVE_STATES: readonly string[] = ["starting", "running", "stopping"];

export const REFRESH_MS = { visible: 5_000, hidden: 30_000 } as const;
export const UPTIME_TICK_MS = 1_000;
export const CPU_DIGITS = 1;

export const PROCESSES_QUERY_KEYS = {
  runtime: ["runtime"] as const,
} as const;

export const PROCESSES_MUTATIONS = {
  stop: ["processes", "stop"] as const,
} as const;

export const CONNECTION_EMPTY_ICONS: Record<Exclude<ConnectionStatus, "online">, IconName> = {
  unconfigured: "sandbox",
  discovering: "sandbox",
  connecting: "sandbox",
  offline: "offline",
  unauthorized: "warning",
  incompatible: "warning",
};

export const EMPTY_ICON: IconName = "processes";
export const ERROR_ICON: IconName = "error";
