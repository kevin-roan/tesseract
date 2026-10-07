import { useEffect } from "react";
import { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { linearTiming } from "@/lib/motion";
import { Durations } from "@/theme";

/** Fill of one PIN dot: grows past full size when a digit lands, shrinks away when it is deleted. */
export function usePinDot(filled: boolean) {
  const reduced = useReducedMotion();
  const fill = useSharedValue(filled ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      fill.set(filled ? 1 : 0);
      return;
    }
    fill.set(
      filled
        ? withSequence(withTiming(1.35, linearTiming(Durations.fastest)), withTiming(1, linearTiming(Durations.fast)))
        : withTiming(0, linearTiming(Durations.fast)),
    );
  }, [filled, reduced, fill]);

  return useAnimatedStyle(() => ({
    opacity: Math.min(fill.value, 1),
    transform: [{ scale: fill.value }],
  }));
}
