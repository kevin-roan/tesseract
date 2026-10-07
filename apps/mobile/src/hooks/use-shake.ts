import { useEffect } from "react";
import { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { linearTiming } from "@/lib/motion";
import { Durations } from "@/theme";

/** A short horizontal shake each time `active` turns on, for rejected input. */
export function useShake(active: boolean, distance = 10) {
  const reduced = useReducedMotion();
  const offset = useSharedValue(0);

  useEffect(() => {
    if (!active || reduced) return;
    const step = linearTiming(Durations.fastest / 2);
    offset.set(
      withSequence(
        withTiming(-distance, step),
        withTiming(distance, step),
        withTiming(-distance * 0.6, step),
        withTiming(distance * 0.6, step),
        withTiming(-distance * 0.3, step),
        withTiming(0, step),
      ),
    );
  }, [active, reduced, distance, offset]);

  return useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
}
