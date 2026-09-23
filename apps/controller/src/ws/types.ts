import type { VncBridge } from "../services/vnc-bridge";

export type WsRouteKind = "events" | "terminal" | "processLogs" | "buildLogs" | "agentRun" | "vnc";

type Base = { cleanup: (() => void) | null };

export type WsData =
  | (Base & { kind: "events" })
  | (Base & { kind: "terminal" | "processLogs" | "buildLogs" | "agentRun"; id: string })
  | (Base & { kind: "vnc"; bridge: VncBridge });

export const EVENTS_TOPIC = "events";
