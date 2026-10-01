import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router";

/** True while the screen is focused and the app is in the foreground; gate endless animations on it. */
export function useScreenActive(): boolean {
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === "active");

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => subscription.remove();
  }, []);

  return focused && foreground;
}
