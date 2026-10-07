import { useEffect } from "react";
import { ipc } from "../../lib/ipc";
import { announceZoom, rememberZoom } from "./zoom-feedback";

export function useZoomFeedback(): void {
  useEffect(() => {
    let active = true;
    ipc.window
      .state()
      .then((state) => {
        if (active) rememberZoom(state.zoom);
      })
      .catch(() => undefined);
    const stop = ipc.window.on("state", (state) => announceZoom(state.zoom));
    return () => {
      active = false;
      stop();
    };
  }, []);
}
