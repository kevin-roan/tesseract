import type { DisplayStatus, DisplayWindow } from "@theone/protocol";
import type { IconName } from "../../theme/icons";
import type { Tone } from "../../theme/colors";
import {
  BACKOFF_BASE_S,
  BACKOFF_MAX_S,
  BACKOFF_MIN_S,
  DEFAULT_DISPLAY,
  META_SEPARATOR,
  PNG_SIGNATURE,
  SCREENSHOT_FILE_PREFIX,
  SCREENSHOT_MIME,
  SVG_MIME,
  UNIT_SCALE_EPSILON,
} from "./constants";
import { BADGE_LABELS, EMPTY_LABELS, OVERLAY_LABELS, WINDOWS_LABELS } from "./labels";
import type { DisplayAction, DisplayMode, FitGeometry, SessionPhase, SessionState } from "./types";

export const INITIAL_SESSION: SessionState = {
  phase: "idle",
  error: null,
  attempt: 0,
  retryAt: null,
  width: null,
  height: null,
  name: "",
  status: null,
};

export function isDisplayReady(status: DisplayStatus | null): boolean {
  return status !== null && status.available && status.vnc.available;
}

export function modeFor(online: boolean, status: DisplayStatus | null, statusError: string | null): DisplayMode {
  if (!online) return "offline";
  if (status === null) return statusError ? "error" : "loading";
  if (isDisplayReady(status)) return "viewer";
  if (status.available) return "preview";
  return "no_display";
}

const BADGE_TONES: Record<keyof typeof BADGE_LABELS, Tone> = {
  offline: "danger",
  loading: "info",
  error: "danger",
  no_display: "neutral",
  preview: "warning",
  idle: "neutral",
  connecting: "info",
  authenticating: "info",
  connected: "success",
  retrying: "warning",
  auth_failed: "danger",
  unavailable: "warning",
  failed: "danger",
};

export interface Badge {
  label: string;
  tone: Tone;
}

export function badge(mode: DisplayMode, phase: SessionPhase): Badge {
  const key = mode === "viewer" ? phase : mode;
  return { label: BADGE_LABELS[key], tone: BADGE_TONES[key] };
}

export function fitGeometry(fbW: number, fbH: number, viewW: number, viewH: number, fit: boolean): FitGeometry {
  if (fbW <= 0 || fbH <= 0 || viewW <= 0 || viewH <= 0) return { scale: 1, offsetX: 0, offsetY: 0 };
  const scale = fit ? Math.min(viewW / fbW, viewH / fbH) : 1;
  return {
    scale,
    offsetX: Math.max(0, Math.round((viewW - fbW * scale) / 2)),
    offsetY: Math.max(0, Math.round((viewH - fbH * scale) / 2)),
  };
}

export function isUnitScale(scale: number): boolean {
  return Math.abs(scale - 1) < UNIT_SCALE_EPSILON;
}

export function mapPointer(x: number, y: number, geometry: FitGeometry, fbW: number, fbH: number): [number, number] {
  const clamp = (value: number, size: number) => Math.min(Math.max(value, 0), Math.max(0, size - 1));
  return [
    clamp(Math.trunc((x - geometry.offsetX) / geometry.scale), fbW),
    clamp(Math.trunc((y - geometry.offsetY) / geometry.scale), fbH),
  ];
}

const positive = (value: number | null | undefined): value is number => typeof value === "number" && value > 0;

export function metaText(mode: DisplayMode, session: SessionState, status: DisplayStatus | null, scale: number | null): string {
  if (mode !== "viewer" && mode !== "preview") return "";
  const parts: string[] = [];
  const sessionSize = mode === "viewer" && positive(session.width) && positive(session.height);
  const width = sessionSize ? session.width : status?.width;
  const height = sessionSize ? session.height : status?.height;
  if (positive(width) && positive(height)) parts.push(`${width}×${height}`);
  if (mode === "viewer" && session.phase === "connected" && scale !== null && scale > 0) {
    parts.push(`${Math.round(scale * 100)}%`);
  }
  if (mode === "viewer" && session.name) parts.push(session.name);
  return parts.join(META_SEPARATOR);
}

const ALL_VIEWER_ACTIONS: readonly DisplayAction[] = [
  "screenshot",
  "browser",
  "reconnect",
  "windows",
  "scale",
  "view_only",
  "clipboard",
  "fullscreen",
];

export function enabledActions(mode: DisplayMode, phase: SessionPhase): ReadonlySet<DisplayAction> {
  switch (mode) {
    case "offline":
      return new Set();
    case "loading":
    case "error":
    case "no_display":
      return new Set(["reconnect"]);
    case "preview":
      return new Set(["screenshot", "browser", "reconnect", "windows"]);
    case "viewer":
      return new Set(phase === "connected" ? [...ALL_VIEWER_ACTIONS, "keys"] : ALL_VIEWER_ACTIONS);
  }
}

export interface EmptyModel {
  icon: IconName | null;
  loading: boolean;
  title: string;
  message: string;
  action: string | null;
}

export function emptyModel(mode: DisplayMode, connectionError: string | null, statusError: string | null, status: DisplayStatus | null): EmptyModel {
  switch (mode) {
    case "offline":
      return { icon: "offline", loading: false, title: EMPTY_LABELS.offlineTitle, message: connectionError ?? "", action: EMPTY_LABELS.retry };
    case "error":
      return { icon: "warning", loading: false, title: EMPTY_LABELS.errorTitle, message: statusError ?? "", action: EMPTY_LABELS.tryAgain };
    case "no_display":
      return {
        icon: "display",
        loading: false,
        title: EMPTY_LABELS.noDisplayTitle,
        message: EMPTY_LABELS.noDisplayMessage(status?.display || DEFAULT_DISPLAY),
        action: EMPTY_LABELS.checkAgain,
      };
    default:
      return { icon: null, loading: true, title: EMPTY_LABELS.loadingTitle, message: EMPTY_LABELS.loadingMessage, action: null };
  }
}

export function errorPrefix(error: string | null): string {
  if (!error) return "";
  const stripped = error.replace(/\.+$/, "");
  return stripped ? `${stripped}. ` : "";
}

export function retrySeconds(retryAt: number | null, now: number): number {
  if (retryAt === null) return 0;
  return Math.max(0, Math.round((retryAt - now) / 1000));
}

export type OverlayAction = "reconnect" | "check";

export interface OverlayModel {
  title: string;
  message: string;
  spinner: boolean;
  actionLabel: string | null;
  action: OverlayAction | null;
}

export function overlayModel(session: SessionState, now: number): OverlayModel | null {
  const error = errorPrefix(session.error);
  const model = (title: string, message: string, spinner: boolean, actionLabel: string | null, action: OverlayAction | null): OverlayModel => ({
    title,
    message: message.trim(),
    spinner,
    actionLabel,
    action,
  });
  switch (session.phase) {
    case "connected":
      return null;
    case "idle":
      return model(OVERLAY_LABELS.idleTitle, "", true, null, null);
    case "connecting":
      return model(OVERLAY_LABELS.connectingTitle, OVERLAY_LABELS.connectingMessage, true, null, null);
    case "authenticating":
      return model(OVERLAY_LABELS.authenticatingTitle, OVERLAY_LABELS.authenticatingMessage, true, null, null);
    case "retrying":
      return model(
        OVERLAY_LABELS.retryingTitle,
        OVERLAY_LABELS.retryingMessage(error, retrySeconds(session.retryAt, now), session.attempt),
        false,
        OVERLAY_LABELS.retryingAction,
        "reconnect",
      );
    case "auth_failed":
      return model(OVERLAY_LABELS.authFailedTitle, OVERLAY_LABELS.authFailedMessage(error), false, OVERLAY_LABELS.authFailedAction, "reconnect");
    case "failed":
      return model(OVERLAY_LABELS.failedTitle, error, false, OVERLAY_LABELS.failedAction, "reconnect");
    case "unavailable":
      return model(OVERLAY_LABELS.unavailableTitle, "", false, OVERLAY_LABELS.unavailableAction, "check");
  }
}

export function windowTitle(window: Pick<DisplayWindow, "title" | "app">): string {
  return window.title.trim() || window.app || WINDOWS_LABELS.untitled;
}

export function windowState(window: Pick<DisplayWindow, "active" | "minimized">): string | null {
  if (window.active) return WINDOWS_LABELS.active;
  if (window.minimized) return WINDOWS_LABELS.minimized;
  return null;
}

export function windowsInOrder<T>(windows: readonly T[]): T[] {
  return [...windows].reverse();
}

export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(BACKOFF_MAX_S, BACKOFF_BASE_S * 2 ** attempt);
  const delay = base / 2 + random() * (base / 2);
  return Math.min(BACKOFF_MAX_S, Math.max(BACKOFF_MIN_S, delay));
}

const pad = (value: number) => String(value).padStart(2, "0");

export function screenshotFileName(date: Date): string {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${SCREENSHOT_FILE_PREFIX}${day}-${time}.png`;
}

export function imageMimeType(bytes: Uint8Array): string {
  const png = PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
  if (png) return SCREENSHOT_MIME;
  const head = new TextDecoder().decode(bytes.subarray(0, 256)).trimStart();
  return head.startsWith("<svg") || head.startsWith("<?xml") ? SVG_MIME : SCREENSHOT_MIME;
}

export function normalizeClipboard(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

export function shouldPushClipboard(input: {
  sync: boolean;
  connected: boolean;
  viewOnly: boolean;
  text: string;
  last: string | null;
}): boolean {
  return input.sync && input.connected && !input.viewOnly && input.text.length > 0 && input.text !== input.last;
}

export function shouldReceiveClipboard(input: { sync: boolean; text: string; last: string | null }): boolean {
  return input.sync && input.text.length > 0 && input.text !== input.last;
}
