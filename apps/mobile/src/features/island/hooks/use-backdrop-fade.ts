import { useEffect } from "react";
import { AppState } from "react-native";
import { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Durations } from "@/theme";

/** Opacity for a backdrop that stays mounted, fading in when `shown` and quicker out when hidden. */
export function useBackdropFade(shown: boolean) {
  const opacity = useSharedValue(shown ? 1 : 0);

  useEffect(() => {
    opacity.set(withTiming(shown ? 1 : 0, { duration: shown ? Durations.normal : Durations.fast }));
  }, [opacity, shown]);

  /** A fade paused by the lock screen snaps to its end value on return instead of leaving the backdrop stuck. */
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      cancelAnimation(opacity);
      opacity.set(shown ? 1 : 0);
    });
    return () => subscription.remove();
  }, [opacity, shown]);

  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}
