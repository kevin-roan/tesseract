import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { clipboardHasImage, watchClipboard } from "../services/clipboard";

export type ClipboardImageState = ReturnType<typeof useClipboardImage>;

/** Offers the copied image once: after `consume` it stays hidden until the clipboard changes or the app comes back from the background. */
export function useClipboardImage() {
  const [hasImage, setHasImage] = useState(false);
  const focusedRef = useRef(false);
  const consumedRef = useRef(false);

  const refresh = useCallback(async () => {
    const present = await clipboardHasImage();
    if (!present) consumedRef.current = false;
    setHasImage(present && !consumedRef.current);
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
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next) => {
      const returning = previous === "background" && next === "active";
      previous = next;
      if (returning) changed();
    });
    const unwatch = watchClipboard(changed);
    return () => {
      subscription.remove();
      unwatch();
    };
  }, [refresh]);

  return { hasImage, refresh, onFocus, onBlur, consume };
}
