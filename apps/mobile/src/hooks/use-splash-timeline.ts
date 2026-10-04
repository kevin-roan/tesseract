import { useEffect, useState } from "react";
import { Easing, useReducedMotion, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { SplashMotion } from "@/theme";

export type SplashTimeline = {
  /** 0 → 1 across the intro. */
  clock: SharedValue<number>;
  /** 0 → 1 across the hand-off into the app. */
  exit: SharedValue<number>;
};

/** Eased 0 → 1 progress of `value` through the `[from, to]` slice of a timeline. */
export function segment(value: number, from: number, to: number) {
  "worklet";
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Drives the launch splash: the intro starts once `started` (assets on screen),
 * the exit waits for both the intro and `ready`, then `onDone` unmounts it.
 */
export function useSplashTimeline(started: boolean, ready: boolean, onDone: () => void): SplashTimeline {
  const reduceMotion = useReducedMotion();
  const clock = useSharedValue(0);
  const exit = useSharedValue(0);
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    if (!started) return;
    clock.set(
      withTiming(1, { duration: reduceMotion ? 0 : SplashMotion.intro, easing: Easing.linear }, (finished) => {
        if (finished) scheduleOnRN(setIntroDone, true);
      }),
    );
  }, [started, reduceMotion, clock]);

  useEffect(() => {
    if (!introDone || !ready) return;
    exit.set(
      withTiming(1, { duration: SplashMotion.exit, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) scheduleOnRN(onDone);
      }),
    );
  }, [introDone, ready, exit, onDone]);

  return { clock, exit };
}
