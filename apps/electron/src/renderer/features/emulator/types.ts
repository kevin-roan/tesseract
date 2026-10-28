import type { TesseractClient } from "@tesseract/client";
import type { AndroidLinkInfo, EmulatorState, IosStreamSettings, UpdateIosStream } from "@tesseract/protocol";
import type { Tone } from "../../theme/colors";
import type { IconName } from "../../theme/icons";
import type { HostAccess } from "../host-shell/types";

export type DeviceKindId = "android" | "ios";

export interface ScreenSize {
  width: number;
  height: number;
}

export type ScreenClientMessage =
  | { type: "touch"; action: "down" | "move" | "up" | "cancel"; pointerId: number; x: number; y: number; width: number; height: number; pressure: number }
  | { type: "scroll"; x: number; y: number; width: number; height: number; hscroll: number; vscroll: number }
  | { type: "key"; key: string }
  | { type: "text"; text: string }
  | { type: "rotate" };

export type ScreenServerMessage =
  | { type: "meta"; deviceName: string; codec: string; width: number; height: number }
  | { type: "size"; width: number; height: number }
  | { type: "error"; message: string };

export interface ScreenKey {
  id: string;
  label: string;
  icon: IconName;
  message: ScreenClientMessage;
}

export interface ScreenSpec {
  path: string;
  deviceParam: string;
  h264: boolean;
  keys: readonly ScreenKey[];
  keyboard: Readonly<Record<string, string>>;
  enterKey: string;
  maxPointers: number;
  maxTextBytes: number;
  maxScroll: number;
  wheelPixelsPerStep: number;
  wheelLinesPerStep: number;
}

export interface ScreenRequest {
  device: string | null;
}

export interface DeviceTarget {
  id: string;
  label: string;
}

export interface DeviceSnapshot {
  available: boolean;
  reason: string | null;
  state: EmulatorState;
  target: string | null;
  targets: readonly DeviceTarget[];
  device: string | null;
  size: ScreenSize | null;
  error: string | null;
  link: AndroidLinkInfo | null;
}

export interface SandboxLink {
  url: string;
  token: string;
}

export interface DeviceControls {
  access: HostAccess;
  snapshot: DeviceSnapshot | null;
  loading: boolean;
  error: string | null;
  starting: boolean;
  stopping: boolean;
  linking: boolean;
  refresh(): void;
  start(target: string): void;
  stop(): void;
  kill(): void;
  link: ((sandbox: SandboxLink) => void) | null;
}

export interface OverlayCopy {
  title: string;
  message: string | null;
}

export interface DeviceLabels {
  noTargets: string;
  noTargetsMessage: string;
  target: string;
  killTooltip: string;
  unavailable: string;
  overlay: Record<"stopped" | "starting" | "stopping" | "failed" | "unavailable", OverlayCopy>;
}

export type StreamSettings = IosStreamSettings;

export interface StreamApi {
  get(client: TesseractClient): Promise<StreamSettings>;
  update(client: TesseractClient, body: UpdateIosStream): Promise<StreamSettings>;
}

export type StreamField = "bitRate" | "maxFps" | "keyFrameInterval" | "jpegQuality";

export interface DeviceKind {
  id: DeviceKindId;
  label: string;
  icon: IconName;
  screen: ScreenSpec;
  labels: DeviceLabels;
  stream: StreamApi;
  useControls(): DeviceControls;
}

export type ScreenStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

export interface ScreenState {
  status: ScreenStatus;
  title: string | null;
  size: ScreenSize | null;
  error: string | null;
}

export interface BadgeModel {
  label: string;
  tone: Tone;
}

export interface OverlayModel {
  title: string;
  message: string | null;
  spinner: boolean;
  actionLabel: string | null;
}
