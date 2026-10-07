import type { ConnectionStatus } from "../../app/connection";

export const TERMINALS_LABELS = {
  title: "Terminals",
  workspace: "Workspace",
} as const;

export const KIND_LABELS: Record<string, string> = {
  shell: "Shell",
  claude: "Claude Code",
};

export const SIDEBAR_LABELS = {
  title: "Sessions",
  empty: "No sessions",
} as const;

export const LAUNCH_LABELS = {
  shell: "Shell",
  claude: "Claude",
  shellTooltip: "Start a shell in the workspace",
  claudeTooltip: "Start Claude Code in the workspace",
  pickerTooltip: "Choose a project",
  pickerTitle: "Start in",
  loadingProjects: "Loading projects…",
} as const;

export const STATE_LABELS = {
  connecting: "Connecting…",
  open: "Live",
  reconnecting: "Reconnecting…",
  exited: "Exited",
  exitedCode: (code: number) => `Exited (${code})`,
  closed: "Disconnected",
  running: "Running",
  unavailable: "Unavailable",
} as const;

export const META_LABELS = {
  started: (when: string) => `started ${when}`,
  size: (cols: number, rows: number) => `${cols}×${rows}`,
  separator: " · ",
} as const;

export const RELATIVE_LABELS = {
  justNow: "just now",
  minutes: (n: number) => `${n}m ago`,
  hours: (n: number) => `${n}h ago`,
  days: (n: number) => `${n}d ago`,
} as const;

export const ACTION_LABELS = {
  restart: "Restart",
  close: "Close session",
  reconnect: "Reconnect",
  remove: "Remove",
  sessions: "Sessions",
  more: "Terminal actions",
  delete: "Delete session",
  deleteRunning: "Terminate and delete session",
} as const;

export const MENU_LABELS = {
  copy: "Copy",
  paste: "Paste",
  selectAll: "Select All",
  zoomIn: "Larger Text",
  zoomOut: "Smaller Text",
  zoomReset: "Reset Text Size",
  clear: "Clear Scrollback",
  terminalMenu: "Terminal menu",
} as const;

export const BANNER_LABELS = {
  exitedTitle: "Session ended",
  exited: (code: number) => `The process exited with code ${code}.`,
  exitedUnknown: "The process exited.",
  closedTitle: "Disconnected",
  closed: (error: string) => `The stream to this session closed. ${error}`.trim(),
  reconnectingTitle: "Connection lost",
  reconnecting: "Trying to reattach; output is replayed once the stream is back.",
} as const;

export const CONFIRM_LABELS = {
  heading: "Delete this session?",
  body: (title: string) => `${title} and everything running in it will be terminated.`,
  cancel: "Cancel",
  confirm: "Terminate & Delete",
} as const;

export const PLACEHOLDER_LABELS = {
  title: "No session selected",
  message: "Start a shell or a Claude Code session in the sandbox, or pick one from the list.",
  shell: "New shell",
  claude: "New Claude session",
} as const;

export interface ConnectionEmptyLabel {
  title: string;
  message: string | null;
  action: "preferences" | "retry" | null;
}

export const CONNECTION_EMPTY_LABELS: Record<Exclude<ConnectionStatus, "online">, ConnectionEmptyLabel> = {
  unconfigured: { title: "Connect to your sandbox", message: "Terminals run inside the sandbox. Connect to it first.", action: "preferences" },
  discovering: { title: "Looking for the sandbox…", message: null, action: null },
  connecting: { title: "Connecting…", message: null, action: null },
  offline: { title: "Sandbox unreachable", message: "{error}", action: "retry" },
  unauthorized: { title: "Token rejected", message: "The controller refused the saved token.", action: "preferences" },
  incompatible: { title: "Version mismatch", message: "{error}", action: "preferences" },
};

export const CONNECTION_ACTION_LABELS = { preferences: "Preferences", retry: "Retry" } as const;
export const ERROR_PLACEHOLDER = "{error}";

export const ERROR_LABELS = {
  create: (error: string) => `Couldn't start the session: ${error}`,
  close: (error: string) => `Couldn't close the session: ${error}`,
  notConnected: "Not connected",
} as const;

export const LINK_LABELS = {
  hint: "Ctrl+click to open",
} as const;
