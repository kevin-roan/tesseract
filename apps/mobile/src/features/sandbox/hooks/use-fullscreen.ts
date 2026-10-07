import { useCallback, useEffect, useState } from "react";
import { BackHandler } from "react-native";

/** Full-screen state for a remote surface; Android's back button leaves full screen first. */
export function useFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setFullscreen(false);
      return true;
    });
    return () => subscription.remove();
  }, [fullscreen]);

  const enter = useCallback(() => setFullscreen(true), []);
  const exit = useCallback(() => setFullscreen(false), []);

  return { fullscreen, enter, exit };
}
