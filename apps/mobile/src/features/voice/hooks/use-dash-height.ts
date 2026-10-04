import { useEffect, useMemo } from "react";
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { Durations } from "@/theme";

export type WaveSpans = {
  from: SharedValue<number[]>;
  to: SharedValue<number[]>;
  progress: SharedValue<number>;
};

/**
 * Column heights for a waveform, eased together by one timing per update so
 * each new meter reading glides every column in place without re-rendering them.
 */
export function useWaveSpans(spans: number[], animated: boolean): WaveSpans {
  const reduced = useReducedMotion();
  const from = useSharedValue(spans);
  const to = useSharedValue(spans);
  const progress = useSharedValue(1);

  useEffect(() => {
    if (!animated || reduced) {
      from.set(spans);
      to.set(spans);
      progress.set(1);
      return;
    }
    const shown = progress.get();
    const previous = from.get();
    const target = to.get();
    from.set(
      spans.map((span, index) => {
        const start = previous[index] ?? span;
        return start + ((target[index] ?? span) - start) * shown;
      }),
    );
    to.set(spans);
    progress.set(0);
    progress.set(withTiming(1, { duration: Durations.fastest }));
  }, [from, to, progress, spans, animated, reduced]);

  return useMemo(() => ({ from, to, progress }), [from, to, progress]);
}

export function useDashHeight(wave: WaveSpans, index: number) {
  const { from, to, progress } = wave;

  return useAnimatedStyle(() => {
    const target = to.value[index] ?? 0;
    const start = from.value[index] ?? target;
    return { height: start + (target - start) * progress.value };
  });
}
