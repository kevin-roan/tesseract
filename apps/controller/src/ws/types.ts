import type { LinkSession, StreamPeer } from "../services/android-link";
import type { VncBridge } from "../services/vnc-bridge";

export type WsRouteKind = "events" | "terminal" | "processLogs" | "buildLogs" | "agentRun" | "vnc" | "androidLink" | "androidLinkStream";

type Base = { cleanup: (() => void) | null };

export type WsData =
  | (Base & { kind: "events" })
  | (Base & { kind: "terminal" | "processLogs" | "buildLogs" | "agentRun"; id: string })
  | (Base & { kind: "androidLinkStream"; id: string; peer?: StreamPeer })
  | (Base & { kind: "androidLink"; session: LinkSession | null })
  | (Base & { kind: "vnc"; bridge: VncBridge });

export const EVENTS_TOPIC = "events";
