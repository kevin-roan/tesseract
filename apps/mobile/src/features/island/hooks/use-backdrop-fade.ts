import { useEffect } from "react";
import { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Durations } from "@/theme";

/** Opacity for a backdrop that stays mounted, fading in when `shown` and quicker out when hidden. */
export function useBackdropFade(shown: boolean) {
  const opacity = useSharedValue(shown ? 1 : 0);

  useEffect(() => {
    opacity.set(withTiming(shown ? 1 : 0, { duration: shown ? Durations.normal : Durations.fast }));
  }, [opacity, shown]);

  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}
