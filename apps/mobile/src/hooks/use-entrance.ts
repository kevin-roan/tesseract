import { useMemo } from "react";
import { FadeInDown } from "react-native-reanimated";

import { MotionEasing } from "@/lib/motion";
import { Durations, Stagger, StaggerCap } from "@/theme";

/**
 * Entrance for the `index`-th item of a list or screen section: a short
 * linear rise with a fade, staggered after the items before it. Items past
 * `StaggerCap` arrive together with the last delayed one.
 */
export function useEntrance(index = 0, stagger: keyof typeof Stagger = "normal") {
  const step = Math.min(index, StaggerCap);

  return useMemo(
    () =>
      FadeInDown.delay(Durations.fast + step * Stagger[stagger])
        .duration(Durations.slow)
        .easing(MotionEasing),
    [step, stagger],
  );
}
