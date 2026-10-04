import { useEffect } from "react";
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { linearTiming } from "@/lib/motion";
import { Durations } from "@/theme";

/**
 * Grow a chart mark up from nothing once on mount: `y` grows columns from their baseline, `x` grows bars from their
 * start. Growth waits for `ready` (e.g. the chart has been measured). Pair the style with a `transformOrigin` on the
 * same view.
 */
export function useGrowIn(axis: "x" | "y", delay = 0, ready = true) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced || !ready) return;
    progress.value = withDelay(delay, withTiming(1, linearTiming(Durations.slow)));
  }, [progress, reduced, delay, ready]);

  return useAnimatedStyle(() => ({
    transform: axis === "x" ? [{ scaleX: progress.value }] : [{ scaleY: progress.value }],
  }));
}
