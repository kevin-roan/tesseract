import { useEffect } from "react";
import {
  interpolateColor,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { linearTiming } from "@/lib/motion";
import { Durations } from "@/theme";

export type BarMotionInput = {
  fill: number;
  frameHeight: number;
  radius: number;
  focused: boolean;
  index: number;
  count: number;
  color: string;
  focusColor: string;
};

/** Grows a bar up from the baseline (sweeping left to right on first show) and cross-fades its focus color. */
export function useBarMotion({ fill, frameHeight, radius, focused, index, count, color, focusColor }: BarMotionInput) {
  const reduced = useReducedMotion();
  const height = useSharedValue(reduced ? fill : 0);
  const lit = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      height.set(fill);
      return;
    }
    const delay = (Durations.slow * index) / Math.max(1, count);
    height.set(withDelay(delay, withTiming(fill, linearTiming(Durations.slow))));
  }, [fill, reduced, height, index, count]);

  useEffect(() => {
    lit.set(reduced ? Number(focused) : withTiming(Number(focused), linearTiming(Durations.fast)));
  }, [focused, reduced, lit]);

  return useAnimatedProps(() => {
    const value = Math.min(frameHeight, Math.max(0, height.get()));
    return {
      y: frameHeight - value,
      height: value,
      rx: Math.min(radius, value / 2),
      fill: interpolateColor(lit.get(), [0, 1], [color, focusColor]),
    };
  });
}
