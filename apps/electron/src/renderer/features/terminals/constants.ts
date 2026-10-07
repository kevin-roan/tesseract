import type { TerminalKind } from "@theone/protocol";
import type { IconName } from "../../theme/icons";
import type { Tone } from "../../theme/colors";
import type { ConnectionStatus } from "../../app/connection";
import { LAUNCH_LABELS } from "./labels";
import type { SessionState } from "./types";

export const TERMINAL_KINDS = ["shell", "claude"] as const satisfies readonly TerminalKind[];

export const KIND_ICONS: Record<string, IconName> = {
  shell: "terminal",
  claude: "agents",
};
export const DEFAULT_KIND_ICON: IconName = "terminal";
export interface LauncherConfig {
  kind: TerminalKind;
  icon: IconName;
  label: string;
  tooltip: string;
}

export const LAUNCHERS: readonly LauncherConfig[] = [
  { kind: "shell", icon: "terminal", label: LAUNCH_LABELS.shell, tooltip: LAUNCH_LABELS.shellTooltip },
  { kind: "claude", icon: "agents", label: LAUNCH_LABELS.claude, tooltip: LAUNCH_LABELS.claudeTooltip },
];

export const LIST_REFRESH_MS = { visible: 10_000, hidden: 60_000 } as const;
export const WORKSPACE_ICON: IconName = "sandbox";
export const PROJECT_ICON: IconName = "project";

export const STATE_TONES: Record<SessionState, Tone> = {
  connecting: "info",
  open: "success",
  reconnecting: "warning",
  exited: "neutral",
  closed: "danger",
  unavailable: "danger",
};

export const INPUT_STATES: readonly SessionState[] = ["open", "connecting", "reconnecting"];

export const SPLIT = {
  minSidebar: 240,
  maxSidebar: 320,
  observed: 300,
  minContent: 280,
  collapseAt: 560,
} as const;

export const MAX_ATTACHED = 6;
export const INPUT_QUEUE_CAP = 65_536;
export const RESIZE_DEBOUNCE_MS = 90;
export const TIME_TICK_MS = 30_000;
export const RECONNECT_DELAY_MS = { min: 1_000, max: 30_000 } as const;

export const FALLBACK_GRID = { cols: 100, rows: 30 } as const;
export const ESTIMATE_CELL = { width: 8.4, height: 16 } as const;

export const FONT_SIZE = { default: 14, min: 8, max: 36, step: 1 } as const;
export const TERMINAL_PADDING_PX = 10;
export const PICKER_NAME_MAX = 32;

export const RELATIVE_SECONDS = { justNow: 45, minute: 60, hour: 3_600, day: 86_400, week: 604_800 } as const;

export const SHIFT_ENTER_SEQUENCE = "\x1b\r";
export const HIDE_CURSOR_SEQUENCE = "\x1b[?25l";

export const TERMINALS_QUERY_KEYS = {
  list: ["terminals", "list"] as const,
};

export const CONNECTION_EMPTY_ICONS: Record<Exclude<ConnectionStatus, "online">, IconName> = {
  unconfigured: "sandbox",
  discovering: "sandbox",
  connecting: "sandbox",
  offline: "offline",
  unauthorized: "warning",
  incompatible: "warning",
};
