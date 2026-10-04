import { useCallback } from "react";
import { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useAppTheme } from "@/hooks/use-app-theme";
import { Durations } from "@/theme";

/** Lifts the composer's border while the input has focus. */
export function useComposerFocus(onFocus?: () => void, onBlur?: () => void) {
  const theme = useAppTheme();
  const focus = useSharedValue(0);
  const rest = theme.colors.border;
  const active = theme.colors.borderStrong;

  const handleFocus = useCallback(() => {
    focus.set(withTiming(1, { duration: Durations.fast }));
    onFocus?.();
  }, [focus, onFocus]);
  const handleBlur = useCallback(() => {
    focus.set(withTiming(0, { duration: Durations.fast }));
    onBlur?.();
  }, [focus, onBlur]);

  const style = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [rest, active]),
  }));

  return { style, onFocus: handleFocus, onBlur: handleBlur };
}
