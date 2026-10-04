import { useEffect } from "react";
import { cancelAnimation, Easing, useDerivedValue, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import type { Transforms3d } from "@shopify/react-native-skia";

import { ISLAND_ORB_SPIN_MS } from "../utils/constants";

/** Skia transform that turns the orb's ring once per `ISLAND_ORB_SPIN_MS` while `spinning`. */
export function useOrbSpin(spinning: boolean) {
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (!spinning || reduced) {
      cancelAnimation(turn);
      return;
    }
    turn.set(0);
    turn.set(withRepeat(withTiming(1, { duration: ISLAND_ORB_SPIN_MS, easing: Easing.linear }), -1));
    return () => cancelAnimation(turn);
  }, [spinning, reduced, turn]);

  return useDerivedValue<Transforms3d>(() => [{ rotate: turn.value * Math.PI * 2 }]);
}
