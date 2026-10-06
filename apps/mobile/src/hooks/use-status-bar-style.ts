import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { setStatusBarStyle, type StatusBarStyle } from "expo-status-bar";

import { useAppTheme } from "@/hooks/use-app-theme";

/** Status bar style for the focused screen, restored to the scheme's own style when it blurs. */
export function useStatusBarStyle(style: StatusBarStyle) {
  const theme = useAppTheme();
  const fallback: StatusBarStyle = theme.mode === "light" ? "dark" : "light";

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(style, true);
      return () => setStatusBarStyle(fallback, true);
    }, [style, fallback]),
  );
}
