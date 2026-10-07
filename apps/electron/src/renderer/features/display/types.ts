import type { DisplayStatus } from "@theone/protocol";

export type DisplayMode = "offline" | "loading" | "error" | "no_display" | "preview" | "viewer";

export type SessionPhase =
  | "idle"
  | "connecting"
  | "authenticating"
  | "connected"
  | "retrying"
  | "auth_failed"
  | "unavailable"
  | "failed";

export interface SessionState {
  phase: SessionPhase;
  error: string | null;
  attempt: number;
  retryAt: number | null;
  width: number | null;
  height: number | null;
  name: string;
  status: DisplayStatus | null;
}

export type DisplayAction =
  | "scale"
  | "windows"
  | "view_only"
  | "clipboard"
  | "keys"
  | "screenshot"
  | "browser"
  | "reconnect"
  | "fullscreen";

export interface FitGeometry {
  scale: number;
  offsetX: number;
  offsetY: number;
}
