import { useEffect } from "react";
import { useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";

import { linearTiming } from "@/lib/motion";
import { Durations } from "@/theme";

/** Dash offset props for a ring arc that sweeps from its last value to `value` (0–1). */
export function useRingSweep(value: number, circumference: number) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(value, linearTiming(Durations.slower)));
  }, [value, progress]);

  return useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - progress.get()) }));
}
