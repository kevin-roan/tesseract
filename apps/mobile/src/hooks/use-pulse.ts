import { useEffect } from "react";
import {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { linearTiming } from "@/lib/motion";
import { Durations } from "@/theme";

/** A slow breathing scale and fade while `active`, settling back when it stops. */
export function usePulse(active: boolean, depth = 0.08) {
  const reduced = useReducedMotion();
  const phase = useSharedValue(0);

  useEffect(() => {
    if (active && !reduced) {
      phase.set(withRepeat(withTiming(1, linearTiming(Durations.slow * 2)), -1, true));
      return;
    }
    cancelAnimation(phase);
    phase.set(withTiming(0, linearTiming(Durations.fast)));
  }, [active, reduced, phase]);

  return useAnimatedStyle(() => ({
    opacity: 1 - phase.value * depth * 4,
    transform: [{ scale: 1 + phase.value * depth }],
  }));
}
