import { useEffect } from "react";
import {
  Easing,
  cancelAnimation,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useScreenActive } from "@/hooks/use-screen-active";

/** Seconds since the loop started, wrapping every `period` seconds; holds still while hidden or with reduced motion. */
export function useLoopClock(period: number, initial = 0) {
  const reduceMotion = useReducedMotion();
  const active = useScreenActive();
  const t = useSharedValue(initial);

  useEffect(() => {
    if (reduceMotion || !active) return;
    const start = t.value % period;
    t.value = start;
    t.value = withRepeat(withTiming(start + period, { duration: period * 1000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [t, period, reduceMotion, active]);

  return t;
}
