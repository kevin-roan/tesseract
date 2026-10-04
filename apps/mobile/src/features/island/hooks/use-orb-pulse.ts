import { useEffect } from "react";
import { cancelAnimation, Easing, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { ISLAND_ORB_PULSE_MS } from "../utils/constants";

/** 0→1→0 breath for the live dot's glow while `pulsing`; holds at 1 under reduced motion. */
export function useOrbPulse(pulsing: boolean) {
  const reduced = useReducedMotion();
  const breath = useSharedValue(0);

  useEffect(() => {
    if (!pulsing || reduced) {
      cancelAnimation(breath);
      breath.set(withTiming(pulsing ? 1 : 0));
      return;
    }
    breath.set(0);
    breath.set(withRepeat(withTiming(1, { duration: ISLAND_ORB_PULSE_MS, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(breath);
  }, [pulsing, reduced, breath]);

  return breath;
}
