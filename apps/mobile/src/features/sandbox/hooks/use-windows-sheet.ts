import { useCallback } from "react";
import type { DisplayWindow } from "@theone/protocol";

import { confirm } from "@/lib/confirm";

import { describeError } from "../utils/errors";
import { WINDOWS_COPY } from "../utils/windows";
import { useActivateDisplayWindow, useCloseDisplayWindow } from "./use-sandbox-mutations";
import { useDisplayWindows } from "./use-sandbox-queries";

/** The windows on the sandbox display, polled while the sheet is open, with bring-to-front, close and force quit. */
export function useWindowsSheet(visible: boolean, onClose: () => void) {
  const query = useDisplayWindows(visible);
  const activation = useActivateDisplayWindow();
  const closing = useCloseDisplayWindow();
  const { refetch } = query;
  const { mutate: activateWindow } = activation;
  const { mutate: closeWindow } = closing;

  const refresh = useCallback(() => void refetch(), [refetch]);

  const activate = useCallback(
    (window: DisplayWindow) => activateWindow(window.id, { onSuccess: onClose }),
    [activateWindow, onClose],
  );

  const close = useCallback((window: DisplayWindow) => closeWindow({ id: window.id, force: false }), [closeWindow]);

  const forceQuit = useCallback(
    async (window: DisplayWindow) => {
      const confirmed = await confirm({
        title: WINDOWS_COPY.forceTitle,
        message: WINDOWS_COPY.forceMessage,
        confirmLabel: "Force quit",
        destructive: true,
      });
      if (confirmed) closeWindow({ id: window.id, force: true });
    },
    [closeWindow],
  );

  const failure = closing.error ?? activation.error;

  return {
    windows: query.data?.windows ?? null,
    loading: query.isLoading,
    refreshing: query.isFetching,
    error: query.error ? describeError(query.error) : null,
    actionError: failure ? describeError(failure) : null,
    busyId: closing.isPending ? closing.variables.id : activation.isPending ? activation.variables : null,
    refresh,
    activate,
    close,
    forceQuit: (window: DisplayWindow) => void forceQuit(window),
  };
}
