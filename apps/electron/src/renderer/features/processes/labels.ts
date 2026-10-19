import type { ConnectionStatus } from "../../app/connection";
import type { ProcessGroupId } from "./types";

export const PROCESSES_LABELS = {
  title: "Processes",
  refresh: "Refresh",
  listLabel: (group: string) => `${group} list`,
  groups: {
    process: "Processes",
    "app-run": "App runs",
    "agent-run": "Agents",
    terminal: "Terminals",
    browser: "Browser",
    vnc: "Display / VNC",
    emulator: "Host devices",
  } satisfies Record<ProcessGroupId, string>,
  states: {
    running: "Running",
    starting: "Starting",
    stopping: "Stopping",
    idle: "Idle",
    waiting: "Waiting",
    failed: "Failed",
  } as Record<string, string>,
  supervised: "Supervised — will restart",
  pid: (pid: number) => `PID ${pid}`,
  uptime: (duration: string) => `up ${duration}`,
  cpu: (percent: string) => `${percent}% CPU`,
  hostEmulator: "Android emulator",
  hostSimulator: "iOS Simulator",
  hostDeviceDetail: (detail: string | null) => detail ?? "On the host",
  actions: {
    stop: "Stop",
    kill: "Force kill",
    stopped: (name: string) => `Sent stop to ${name}`,
    killed: (name: string) => `Killed ${name}`,
    failed: (name: string, error: string) => `Couldn't stop ${name}: ${error}`,
  },
  confirm: {
    heading: "Force kill?",
    body: (name: string) => `${name} is killed immediately with SIGKILL. It gets no chance to save its work or clean up.`,
    supervisedBody: (name: string) =>
      `${name} is killed immediately with SIGKILL. It gets no chance to save its work or clean up. It is supervised, so the sandbox will start it again.`,
    confirm: "Force kill",
    cancel: "Cancel",
  },
  empty: { title: "Nothing is running", message: "Processes, app runs, agents, terminals, the browser and the display show up here while they run." },
  loading: "Loading processes…",
  errorTitle: "Couldn't load processes",
  retry: "Retry",
  notConnected: "Not connected",
} as const;

export interface ConnectionEmptyLabel {
  title: string;
  message: string | null;
  action: "preferences" | "retry" | null;
}

export const CONNECTION_EMPTY_LABELS: Record<Exclude<ConnectionStatus, "online">, ConnectionEmptyLabel> = {
  unconfigured: { title: "Connect to your sandbox", message: "Processes run inside the sandbox. Connect to it first.", action: "preferences" },
  discovering: { title: "Looking for the sandbox…", message: null, action: null },
  connecting: { title: "Connecting…", message: null, action: null },
  offline: { title: "Sandbox unreachable", message: "{error}", action: "retry" },
  unauthorized: { title: "Token rejected", message: "The controller refused the saved token.", action: "preferences" },
  incompatible: { title: "Version mismatch", message: "{error}", action: "preferences" },
};

export const CONNECTION_ACTION_LABELS = { preferences: "Preferences", retry: "Retry" } as const;
export const ERROR_PLACEHOLDER = "{error}";
