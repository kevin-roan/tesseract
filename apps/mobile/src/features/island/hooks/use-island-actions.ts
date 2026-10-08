import { useEffect } from "react";
import { AppState } from "react-native";

import { addIslandActionListener, addSharedItemsListener, drainActions, isIslandAvailable } from "@/modules/tesseract-island";

import { useIslandDispatch } from "./use-island-dispatch";

/** Handles taps on the Live Activity, notification and share sheet, live and queued while the app was closed. */
export function useIslandActions(): void {
  const { dispatch, collectShared } = useIslandDispatch();

  useEffect(() => {
    if (!isIslandAvailable()) return;
    let disposed = false;
    const drain = async () => {
      await collectShared();
      const queued = await drainActions().catch(() => []);
      for (const action of queued) {
        if (disposed) return;
        await dispatch(action);
      }
    };
    void drain();
    const actions = addIslandActionListener((action) => void dispatch(action));
    const shared = addSharedItemsListener(() => void collectShared());
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void drain();
    });
    return () => {
      disposed = true;
      actions.remove();
      shared.remove();
      appState.remove();
    };
  }, [dispatch, collectShared]);
}
