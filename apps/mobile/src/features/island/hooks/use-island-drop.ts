import { useCallback } from "react";
import { ReduceMotion, withSpring, withTiming } from "react-native-reanimated";

import { Durations } from "@/theme";

import { ISLAND_DROP_FROM, ISLAND_OPEN_SPRING } from "../utils/constants";

/** Entering animation for a card that grows down out of the Dynamic Island at the top of the screen. */
export function useIslandDrop() {
  return useCallback(() => {
    "worklet";
    const spring = { ...ISLAND_OPEN_SPRING, reduceMotion: ReduceMotion.System };
    return {
      initialValues: {
        opacity: 0,
        transform: [
          { translateY: ISLAND_DROP_FROM.translateY },
          { scaleX: ISLAND_DROP_FROM.scaleX },
          { scaleY: ISLAND_DROP_FROM.scaleY },
        ],
      },
      animations: {
        opacity: withTiming(1, { duration: Durations.fast, reduceMotion: ReduceMotion.System }),
        transform: [{ translateY: withSpring(0, spring) }, { scaleX: withSpring(1, spring) }, { scaleY: withSpring(1, spring) }],
      },
    };
  }, []);
}
