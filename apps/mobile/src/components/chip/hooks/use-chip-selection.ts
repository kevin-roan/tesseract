import { useEffect } from "react";
import { interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { linearTiming } from "@/lib/motion";
import type { Theme } from "@/theme";

/** Cross-fades a chip's fill and rim into the selected look instead of snapping. */
export function useChipSelection(theme: Theme, selected: boolean, enabled: boolean) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(selected ? 1 : 0);
  const { surfaceElevated, backgroundSelected, borderStrong, accentStrong } = theme.colors;

  useEffect(() => {
    const target = selected ? 1 : 0;
    progress.value = reduced ? target : withTiming(target, linearTiming());
  }, [selected, reduced, progress]);

  return useAnimatedStyle(() =>
    enabled
      ? {
          backgroundColor: interpolateColor(progress.value, [0, 1], [surfaceElevated, backgroundSelected]),
          borderColor: interpolateColor(progress.value, [0, 1], [borderStrong, accentStrong]),
        }
      : {},
  );
}
