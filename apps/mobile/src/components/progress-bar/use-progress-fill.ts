import { useEffect } from "react";
import { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { linearTiming } from "@/lib/motion";
import { Durations } from "@/theme";

/** Width style for a progress fill that eases from its last value to `percent`. */
export function useProgressFill(percent: number) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.set(withTiming(percent, linearTiming(Durations.slower)));
  }, [percent, width]);

  return useAnimatedStyle(() => ({ width: `${width.get()}%` }));
}
