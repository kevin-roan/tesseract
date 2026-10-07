import type { Tone } from "../../../shared/contracts/common";
import type { ConnectionState, ConnectionStatus, EventsStatus } from "./types";

export const STATUS_INTERVAL_MS = 5_000;
export const STATUS_INTERVAL_HIDDEN_MS = 30_000;
export const INBOX_LIMIT = 1;

export const SLOW_POLL_STATUSES: readonly ConnectionStatus[] = ["unauthorized", "incompatible"];
export const BANNERLESS_STATUSES: readonly ConnectionStatus[] = ["connecting", "online"];

export const CONNECTION_TONES: Record<ConnectionStatus, Tone> = {
  unconfigured: "neutral",
  discovering: "info",
  connecting: "info",
  online: "success",
  offline: "danger",
  unauthorized: "warning",
  incompatible: "warning",
};

export const EVENTS_TONES: Record<EventsStatus, Tone> = {
  idle: "neutral",
  connecting: "info",
  open: "success",
  closed: "neutral",
  unavailable: "neutral",
  incompatible: "warning",
};

export const EMPTY_INBOX = { unreadCount: 0, attentionCount: 0 } as const;

export const INITIAL_CONNECTION_STATE: ConnectionState = {
  status: "unconfigured",
  config: null,
  configFile: null,
  health: null,
  sandbox: null,
  errorMessage: null,
  checkedAt: null,
  events: "idle",
  inbox: EMPTY_INBOX,
  windowVisible: true,
};

export const RETRYABLE_API_STATUSES: readonly number[] = [408, 429];

export const METRICS = {
  windowS: 3600,
  maxSamples: 1500,
  gapS: 95,
  saveIntervalS: 30,
  maxSandboxes: 4,
  futureToleranceS: 60,
  version: 1,
} as const;

export const METRIC_RANGES = {
  "5m": 300,
  "15m": 900,
  "1h": 3600,
} as const;

export const SERIES_KEYS = ["load1", "load5", "load15", "memory", "disk"] as const;
