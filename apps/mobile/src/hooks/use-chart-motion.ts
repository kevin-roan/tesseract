import { useEffect } from "react";
import {
  Easing,
  cancelAnimation,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { linearTiming } from "@/lib/motion";
import { ChartMotion } from "@/theme";

export type ChartMotionValues = {
  reveal: SharedValue<number>;
  cycle: SharedValue<number>;
};

export function useChartMotion(active: boolean, period: number, loop = true): ChartMotionValues {
  const reduceMotion = useReducedMotion();
  const reveal = useSharedValue(0);
  const cycle = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    reveal.value = reduceMotion
      ? 1
      : withTiming(1, linearTiming(ChartMotion.reveal));
  }, [active, reduceMotion, reveal]);

  useEffect(() => {
    if (!active || !loop || reduceMotion) return;
    cycle.value = 0;
    cycle.value = withRepeat(withTiming(1, { duration: period, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(cycle);
  }, [active, loop, period, reduceMotion, cycle]);

  return { reveal, cycle };
}
