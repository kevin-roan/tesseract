import { useEffect, useMemo } from "react";
import {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";

import { linearTiming, MotionEasing } from "@/lib/motion";
import { Durations, Opacity, PressScale } from "@/theme";

/** Eases a control between its resting and disabled look, and pops in swapped icons. */
export function useEnableMotion(enabled: boolean) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(enabled ? 1 : 0);

  useEffect(() => {
    const target = enabled ? 1 : 0;
    progress.value = reduced ? target : withTiming(target, linearTiming());
  }, [enabled, progress, reduced]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [Opacity.disabled, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [PressScale.control, 1]) }],
  }));

  const iconEntering = useMemo(
    () => ZoomIn.duration(Durations.normal).easing(MotionEasing),
    [],
  );

  return { style, iconEntering };
}
