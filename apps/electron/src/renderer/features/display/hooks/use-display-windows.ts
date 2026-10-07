import type { TheOneClient } from "@theone/client";
import type { DisplayWindow } from "@theone/protocol";
import { useCallback, useMemo, useRef, useState } from "react";
import { describeError, usePoller } from "../../../app/connection";
import { showToast } from "../../../components/Toast";
import { WINDOWS_POLL_MS } from "../constants";
import { TOAST_LABELS } from "../labels";
import { windowsInOrder } from "../model";

export interface DisplayWindowsHandle {
  windows: DisplayWindow[] | null;
  error: string | null;
  busy: boolean;
  refresh(): void;
  activate(id: string): Promise<boolean>;
  close(id: string, force?: boolean): Promise<boolean>;
}

export function useDisplayWindows(client: TheOneClient | null, open: boolean): DisplayWindowsHandle {
  const [windows, setWindows] = useState<DisplayWindow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const poller = usePoller((signal) => (client ? client.displayWindows({ signal }) : Promise.reject(new Error())), WINDOWS_POLL_MS, {
    enabled: open && client !== null,
    onResult: (list) => {
      setWindows(windowsInOrder(list.windows));
      setError(null);
    },
    onError: (reason) => {
      setWindows(null);
      setError(describeError(reason));
    },
  });
  const pollerRef = useRef(poller);
  pollerRef.current = poller;

  const run = useCallback(
    async (call: (client: TheOneClient) => Promise<void>): Promise<boolean> => {
      if (!client || busyRef.current) return false;
      busyRef.current = true;
      setBusy(true);
      try {
        await call(client);
        return true;
      } catch (reason) {
        showToast(TOAST_LABELS.windowActionFailed(describeError(reason)));
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
        pollerRef.current.refresh();
      }
    },
    [client],
  );

  const activate = useCallback((id: string) => run((api) => api.activateDisplayWindow(id)), [run]);
  const close = useCallback((id: string, force = false) => run((api) => api.closeDisplayWindow(id, force ? { force: true } : {})), [run]);
  const refresh = useCallback(() => pollerRef.current.refresh(), []);

  return useMemo(() => ({ windows, error, busy, refresh, activate, close }), [windows, error, busy, refresh, activate, close]);
}
