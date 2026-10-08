import { useMemo } from "react";
import { interpolateColor, useDerivedValue } from "react-native-reanimated";

import { useLoopClock } from "@/hooks/use-loop-clock";

/**
 * A color that walks linearly through `colors` and back to the first, once every
 * `period` seconds; `offset` starts it part way round (0–1). Holds still while
 * hidden or with reduced motion.
 */
export function useAnimatedColors(colors: readonly string[], period: number, offset = 0) {
  const t = useLoopClock(period, offset * period);
  const stops = useMemo(() => [...colors, colors[0] ?? "transparent"], [colors]);
  const input = useMemo(() => stops.map((_, index) => index / (stops.length - 1)), [stops]);

  return useDerivedValue(() => {
    const progress = t.value / period;
    return interpolateColor(progress - Math.floor(progress), input, stops);
  });
}
