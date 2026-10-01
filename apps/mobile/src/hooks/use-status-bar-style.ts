import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { setStatusBarStyle, type StatusBarStyle } from "expo-status-bar";

/** Status bar style for the focused screen, restored to `auto` when it blurs. */
export function useStatusBarStyle(style: StatusBarStyle) {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(style, true);
      return () => setStatusBarStyle("auto", true);
    }, [style]),
  );
}
