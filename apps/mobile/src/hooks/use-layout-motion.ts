import { useMemo } from "react";
import { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";

import { MotionEasing } from "@/lib/motion";
import { Durations } from "@/theme";

/** Shared layout animations: a linear glide when neighbours move, a fade in, and a quicker fade out. */
export function useLayoutMotion() {
  return useMemo(
    () => ({
      layout: LinearTransition.duration(Durations.normal).easing(MotionEasing),
      fadeIn: FadeIn.duration(Durations.normal),
      fadeOut: FadeOut.duration(Durations.fast),
    }),
    [],
  );
}
