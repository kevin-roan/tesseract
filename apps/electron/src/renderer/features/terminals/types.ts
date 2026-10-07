import type { TerminalKind } from "@theone/protocol";
import type { Tone } from "../../theme/colors";
import type { IconName } from "../../theme/icons";

export type SessionState = "connecting" | "open" | "reconnecting" | "exited" | "closed" | "unavailable";

export interface LiveSession {
  state: SessionState;
  exitCode: number | null;
  error: string | null;
  title: string | null;
  cols: number;
  rows: number;
  hasSelection: boolean;
}

export interface LaunchRequest {
  kind: TerminalKind;
  projectId: string | null;
}

export type OpenRequest = { type: "attach"; terminalId: string } | ({ type: "launch" } & LaunchRequest);

export interface SessionRowModel {
  id: string;
  icon: IconName;
  title: string;
  subtitle: string;
  status: string;
  tone: Tone;
  running: boolean;
}

export interface BadgeModel {
  label: string;
  tone: Tone;
}

export type BannerAction = "restart" | "reconnect";

export interface BannerModel {
  title: string;
  message: string;
  tone: Tone;
  action: BannerAction | null;
}

export interface Grid {
  cols: number;
  rows: number;
}

export type TerminalCommand =
  | "copy"
  | "paste"
  | "selectAll"
  | "zoomIn"
  | "zoomOut"
  | "zoomReset"
  | "clear"
  | "pageUp"
  | "pageDown"
  | "scrollTop"
  | "scrollBottom"
  | "shiftEnter";
