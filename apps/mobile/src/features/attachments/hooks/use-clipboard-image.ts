import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { clipboardHasImage, watchClipboard } from "../services/clipboard";

export type ClipboardImageState = ReturnType<typeof useClipboardImage>;

/**
 * Offers the copied image once: after `consume` the chip stays hidden until the clipboard changes or the app becomes active again.
 * `present` ignores that and backs the Attach menu, so a long-lived composer (the home tab) can always paste what is copied.
 */
export function useClipboardImage() {
  const [present, setPresent] = useState(false);
  const [hasImage, setHasImage] = useState(false);
  const focusedRef = useRef(false);
  const consumedRef = useRef(false);

  const refresh = useCallback(async () => {
    const found = await clipboardHasImage();
    if (!found) consumedRef.current = false;
    setPresent(found);
    setHasImage(found && !consumedRef.current);
  }, []);

  const onFocus = useCallback(() => {
    focusedRef.current = true;
    void refresh();
  }, [refresh]);

  const onBlur = useCallback(() => {
    focusedRef.current = false;
  }, []);

  const consume = useCallback(() => {
    consumedRef.current = true;
    setHasImage(false);
  }, []);

  useEffect(() => {
    const changed = () => {
      consumedRef.current = false;
      if (focusedRef.current) void refresh();
    };
    // iOS only reports in-app clipboard changes, and copying from a screenshot overlay or another app in
    // Slide Over leaves the app "inactive" rather than "background", so any return to active counts.
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next) => {
      const returning = previous !== "active" && next === "active";
      previous = next;
      if (returning) changed();
    });
    const unwatch = watchClipboard(changed);
    return () => {
      subscription.remove();
      unwatch();
    };
  }, [refresh]);

  return { present, hasImage, refresh, onFocus, onBlur, consume };
}
