import { useEffect } from "react";
import { Easing, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { useScreenActive } from "@/hooks/use-screen-active";
import { SplashMotion } from "@/theme";

/** A 0→1 clock that replays the edge light each time the screen comes back into view. */
export function useMonolithIntro() {
  const reduceMotion = useReducedMotion();
  const active = useScreenActive();
  const clock = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    clock.set(0);
    clock.set(
      withTiming(1, {
        duration: reduceMotion ? 0 : SplashMotion.intro,
        easing: Easing.linear,
      }),
    );
  }, [active, reduceMotion, clock]);

  return clock;
}
