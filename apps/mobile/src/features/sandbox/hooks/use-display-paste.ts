import { useCallback, type RefObject } from "react";

import type { WebSurfaceHandle } from "@/components/web-surface/types";
import { Clipboard } from "@/lib/clipboard";
import { playHaptic } from "@/lib/haptics";

import { pasteMessage, pasteScript } from "../utils/web-bridge";

/** Reads the phone's clipboard and hands the text to the VNC page, which types it into the focused remote field. */
export function useDisplayPaste(surfaceRef: RefObject<WebSurfaceHandle | null>): () => Promise<void> {
  return useCallback(async () => {
    const surface = surfaceRef.current;
    if (!Clipboard || !surface) return;
    let text = "";
    try {
      text = await Clipboard.getStringAsync();
    } catch {
      text = "";
    }
    if (!text) {
      playHaptic("warning");
      return;
    }
    if (!surface.run(pasteScript(text))) surface.post(pasteMessage(text));
    playHaptic("selection");
  }, [surfaceRef]);
}
