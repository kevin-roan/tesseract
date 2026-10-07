import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnectionActions, useConnectionClient, useConnectionState, useIsOnline } from "../../../app/connection";
import { useAccelGuard, useFocusWithin } from "../../../components/AccelGuard";
import { useWindowState } from "../../../shell/hooks/use-window-state";
import { KEY_COMBOS, type KeyComboId } from "../constants";
import {
  badge,
  emptyModel,
  enabledActions,
  fitGeometry,
  metaText,
  modeFor,
  overlayModel,
  type Badge,
  type EmptyModel,
  type OverlayModel,
} from "../model";
import type { DisplayAction, DisplayMode, SessionState } from "../types";
import type { VncSession } from "../vnc/session";
import { useClipboardSync } from "./use-clipboard-sync";
import { useDisplayActions } from "./use-display-actions";
import { useDisplayStatus } from "./use-display-status";
import { useDisplayWindows, type DisplayWindowsHandle } from "./use-display-windows";
import { useElementSize } from "./use-element-size";
import { useFullscreenStage, type FullscreenStage } from "./use-fullscreen-stage";
import { useNow } from "./use-now";
import { useScreenshotPoller } from "./use-screenshot-poller";
import { useVncSession } from "./use-vnc-session";

export interface DisplayPageModel {
  mode: DisplayMode;
  session: SessionState;
  vnc: VncSession;
  host: HTMLDivElement;
  badge: Badge;
  meta: string;
  enabled: ReadonlySet<DisplayAction>;
  empty: EmptyModel;
  overlay: OverlayModel | null;
  picture: string | null;
  scale: number | null;
  fit: boolean;
  viewOnly: boolean;
  clipboardSync: boolean;
  windowsOpen: boolean;
  windows: DisplayWindowsHandle;
  fullscreen: FullscreenStage;
  canvasFocused: boolean;
  setFit(fit: boolean): void;
  setViewOnly(viewOnly: boolean): void;
  setClipboardSync(sync: boolean): void;
  setWindowsOpen(open: boolean): void;
  sendKeys(id: KeyComboId): void;
  reconnect(): void;
  checkAgain(): void;
  runOverlayAction(): void;
  saveScreenshot(): void;
  openInBrowser(): void;
  canvasTakesEscape(): boolean;
}

export function useDisplayPage(): DisplayPageModel {
  const online = useIsOnline();
  const connectionError = useConnectionState((state) => state.errorMessage);
  const connection = useConnectionActions();
  const client = useConnectionClient();
  const windowState = useWindowState();

  const [fit, setFitState] = useState(true);
  const [viewOnly, setViewOnlyState] = useState(false);
  const [clipboardSync, setClipboardSync] = useState(true);
  const [windowsOpen, setWindowsOpen] = useState(false);
  const [fullscreenOn, setFullscreenOn] = useState(false);

  const active = online && (windowState.visible || fullscreenOn);
  const [statusPolling, setStatusPolling] = useState(false);
  const status = useDisplayStatus(client, statusPolling);
  const mode = modeFor(online, status.status, status.error);

  useEffect(() => setStatusPolling(active && mode !== "viewer"), [active, mode]);

  const { session: vnc, state: session, host } = useVncSession(client, active && mode === "viewer");
  const picture = useScreenshotPoller(client, active && mode === "preview", mode === "viewer");

  useEffect(() => {
    if (session.status) status.setStatus(session.status);
  }, [session.status, status.setStatus]);

  useEffect(() => {
    if (!online) status.clear();
  }, [online, status.clear]);

  const fullscreen = useFullscreenStage({
    allowed: online && mode === "viewer",
    windowFullscreen: windowState.fullscreen,
    onEnter: () => requestAnimationFrame(() => vnc.focus()),
  });
  useEffect(() => setFullscreenOn(fullscreen.fullscreen), [fullscreen.fullscreen]);

  const hostRef = useMemo(() => ({ current: host }), [host]);
  const canvasFocused = useFocusWithin(hostRef);
  const connected = session.phase === "connected";
  useAccelGuard(canvasFocused && connected && !viewOnly);
  useClipboardSync({ session: vnc, host, sync: clipboardSync, viewOnly, connected });

  const enabled = useMemo(() => enabledActions(mode, session.phase), [mode, session.phase]);
  useEffect(() => {
    if (!enabled.has("windows")) setWindowsOpen(false);
  }, [enabled]);
  const windows = useDisplayWindows(client, windowsOpen && enabled.has("windows"));
  const actions = useDisplayActions(client);

  const hostSize = useElementSize(host);
  const scale = useMemo(() => {
    if (!session.width || !session.height || hostSize.width <= 0 || hostSize.height <= 0) return null;
    return fitGeometry(session.width, session.height, hostSize.width, hostSize.height, fit).scale;
  }, [fit, hostSize.height, hostSize.width, session.height, session.width]);

  const now = useNow(mode === "viewer" && session.phase === "retrying");

  const checkAgain = useCallback(() => {
    if (!online) connection.refresh();
    else status.checkAgain();
  }, [connection, online, status]);

  const reconnect = useCallback(() => {
    if (mode === "viewer") vnc.reconnect();
    else checkAgain();
  }, [checkAgain, mode, vnc]);

  const overlay = mode === "viewer" ? overlayModel(session, now) : null;
  const runOverlayAction = useCallback(() => {
    if (overlay?.action === "check") checkAgain();
    else vnc.reconnect();
  }, [checkAgain, overlay?.action, vnc]);

  const setFit = useCallback(
    (value: boolean) => {
      setFitState(value);
      vnc.setFit(value);
    },
    [vnc],
  );

  const setViewOnly = useCallback(
    (value: boolean) => {
      setViewOnlyState(value);
      vnc.setViewOnly(value);
    },
    [vnc],
  );

  const sendKeys = useCallback((id: KeyComboId) => vnc.sendKeys(KEY_COMBOS[id]), [vnc]);

  const canvasTakesEscape = useCallback(() => !viewOnly && host.contains(document.activeElement), [host, viewOnly]);

  return {
    mode,
    session,
    vnc,
    host,
    badge: badge(mode, session.phase),
    meta: metaText(mode, session, status.status, scale),
    enabled,
    empty: emptyModel(mode, connectionError, status.error, status.status),
    overlay,
    picture,
    scale,
    fit,
    viewOnly,
    clipboardSync,
    windowsOpen,
    windows,
    fullscreen,
    canvasFocused,
    setFit,
    setViewOnly,
    setClipboardSync,
    setWindowsOpen,
    sendKeys,
    reconnect,
    checkAgain,
    runOverlayAction,
    saveScreenshot: () => void actions.saveScreenshot(),
    openInBrowser: () => void actions.openInBrowser(),
    canvasTakesEscape,
  };
}
