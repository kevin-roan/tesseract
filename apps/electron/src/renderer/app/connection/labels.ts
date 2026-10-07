import type { ConnectionSource } from "../../../shared/contracts/connection";
import type { ConnectionStatus, EventsStatus } from "./types";

export const CONNECTION_STATUS_LABELS: Record<ConnectionStatus, string> = {
  unconfigured: "Not configured",
  discovering: "Discovering…",
  connecting: "Connecting…",
  online: "Online",
  offline: "Offline",
  unauthorized: "Token rejected",
  incompatible: "Incompatible",
};

export const EVENTS_STATUS_LABELS: Record<EventsStatus, string> = {
  idle: "Live updates off",
  connecting: "Live updates connecting…",
  open: "Live",
  closed: "Live updates closed",
  unavailable: "Live updates unavailable",
  incompatible: "Live updates incompatible",
};

export const SOURCE_LABELS: Record<ConnectionSource | "manual", string> = {
  file: "Saved config file",
  env: "Environment variables",
  docker: "Docker discovery",
  manual: "Entered manually",
};

export const CONNECTION_LABELS = {
  sandbox: "Sandbox",
  separator: " · ",
  connectionSettings: "Connection settings",
  sourceTitle: (label: string) => `Source: ${label}`,
  configFile: (path: string) => `Config file: ${path}`,
} as const;

export const BANNER_LABELS = {
  unconfigured: "No sandbox is configured on this machine yet.",
  discovering: "Looking for the sandbox on this machine…",
  offline: (error: string) => `Can't reach the sandbox: ${error}`,
  unauthorized: "The sandbox rejected the saved token.",
  setUp: "Set Up",
  retry: "Retry",
  fixConnection: "Fix Connection",
  details: "Details",
} as const;

export const ERROR_MESSAGES = {
  unauthorized: "The sandbox rejected this token. Update it in Preferences or rediscover the sandbox.",
  timeout: "The sandbox took too long to answer.",
  network: "Can't reach the sandbox. Check that the stack is running and the URL is reachable from this machine.",
  protocolVersion: (server: unknown, client: number) =>
    `The sandbox speaks protocol v${String(server)} and this app speaks v${client}. Update the app or the sandbox so they match.`,
  protocol: "The controller answered in an unexpected format. Update the app or the sandbox so their versions match.",
  notConfigured: "No sandbox is configured yet. Open Preferences to discover it or enter its URL and token.",
  fallback: "Something went wrong.",
  notConfiguredInternal: "No sandbox connection is configured",
  invalidUrl: (url: string) => `Invalid controller URL: ${url}`,
  tokenRequired: "A controller token is required",
  httpStatus: (status: number) => `HTTP ${status}`,
} as const;

export const GATEWAY_MESSAGES: Record<number, string> = {
  502: "HTTP 502 from the proxy in front of the controller: the controller is not answering behind it.",
  503: "HTTP 503: the controller is unavailable.",
  504: "HTTP 504 from the proxy in front of the controller: the controller timed out.",
};

export const GATEWAY_STATUS_TEXT: Record<number, string> = {
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

export const CONNECTION_TOASTS = {
  invalid: "Enter a valid http(s) URL and a token",
  saved: "Connection saved",
  discoveryFailed: (error: string) => `Discovery failed: ${error}`,
} as const;

export const METRIC_RANGE_LABELS = {
  "5m": "5 min",
  "15m": "15 min",
  "1h": "1 h",
} as const;
