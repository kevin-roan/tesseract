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

/** Seconds in one scene loop. Every motion's period divides it, so the wrap is seamless. */
export const SCENE_LOOP = 60;

/** Seconds between spark climbs up the ridge. */
export const SPARK_PERIOD = 6;

/** Fractional part of `value`. */
export function frac(value: number) {
  "worklet";
  return value - Math.floor(value);
}

/**
 * Where the ridge spark is in its cycle: `climb` 0 → 1 as it runs from the base
 * to the tip, `visible` its fade in, and `flare` the light it leaves at the tip.
 */
export function sparkState(t: number) {
  "worklet";
  const cycle = frac(t / SPARK_PERIOD);
  const raw = Math.min(1, Math.max(0, (cycle - 0.08) / 0.42));
  const climb = raw * raw * (3 - 2 * raw);
  const visible = cycle < 0.08 || cycle > 0.5 ? 0 : Math.min(1, raw * 4);
  const flare = cycle < 0.5 ? 0 : Math.exp(-(cycle - 0.5) * 9);
  return { climb, visible, flare };
}

/** Scene time in seconds, looping over `SCENE_LOOP`; holds still while hidden or with reduced motion. */
export function useSceneClock() {
  const reduceMotion = useReducedMotion();
  const active = useScreenActive();
  const t = useSharedValue(SPARK_PERIOD * 0.6);

  useEffect(() => {
    if (reduceMotion || !active) return;
    const start = t.value % SCENE_LOOP;
    t.value = start;
    t.value = withRepeat(
      withTiming(start + SCENE_LOOP, { duration: SCENE_LOOP * 1000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [t, reduceMotion, active]);

  return t;
}
