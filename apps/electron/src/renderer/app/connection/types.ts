import type { Health, SandboxStatus } from "@tesseract/protocol";
import type { ConnectionConfig } from "../../../shared/contracts/connection";

export type ConnectionStatus =
  | "unconfigured"
  | "discovering"
  | "connecting"
  | "online"
  | "offline"
  | "unauthorized"
  | "incompatible";

export type EventsStatus = "idle" | "connecting" | "open" | "closed" | "unavailable" | "incompatible";

export interface InboxCounts {
  unreadCount: number;
  attentionCount: number;
}

export interface ConnectionState {
  status: ConnectionStatus;
  config: ConnectionConfig | null;
  configFile: string | null;
  health: Health | null;
  sandbox: SandboxStatus | null;
  errorMessage: string | null;
  checkedAt: number | null;
  events: EventsStatus;
  inbox: InboxCounts;
  windowVisible: boolean;
}

export type BannerAction = "setup" | "retry" | "preferences";
