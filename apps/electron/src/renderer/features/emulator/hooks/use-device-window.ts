import { useCallback, useEffect, useMemo } from "react";
import { showToast } from "../../../components/Toast";
import { ipc } from "../../../lib/ipc";
import { useHostGate } from "../../host-shell/hooks/use-host-gate";
import { DEVICE_WINDOW_HIDDEN_KEYS } from "../constants";
import { DEVICE_WINDOW_LABELS } from "../labels";
import type { DeviceKind } from "../types";
import { useDeviceView } from "./use-device-view";

export function useDeviceWindow(kind: DeviceKind) {
  const host = useHostGate();
  const view = useDeviceView(kind);
  const { session, state } = view.screen;
  const size = state.size ?? view.snapshot?.size ?? null;
  const width = size?.width ?? null;
  const height = size?.height ?? null;

  useEffect(() => {
    if (width && height) void ipc.window.fitDevice({ width, height }).catch(() => undefined);
  }, [width, height]);

  const screenshot = useCallback(async () => {
    const png = session.capture();
    if (!png) return;
    try {
      const path = await ipc.window.saveDeviceScreenshot(png);
      showToast(DEVICE_WINDOW_LABELS.saved(path), { action: { label: DEVICE_WINDOW_LABELS.reveal, run: () => void ipc.app.showItemInFolder(path) } });
    } catch (error) {
      showToast(DEVICE_WINDOW_LABELS.saveFailed(error instanceof Error ? error.message : String(error)));
    }
  }, [session]);

  const keys = useMemo(() => kind.screen.keys.filter((key) => !DEVICE_WINDOW_HIDDEN_KEYS.includes(key.id)), [kind]);

  return { host, view, keys, screenshot, aspect: width && height ? width / height : null, title: state.title ?? view.snapshot?.target ?? kind.label, connected: state.status === "connected" };
}
