import { useCallback } from "react";
import type { TextInputProps } from "react-native";
import { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Durations } from "@/theme";

type FocusEvent = Parameters<NonNullable<TextInputProps["onFocus"]>>[0];

type FieldColors = {
  border: string;
  focus: string;
  error: string;
  label: string;
  labelFocused: string;
};

/**
 * Focus feedback for a text field without re-rendering it: the border eases
 * to the focus ring and the label brightens while the input has focus. An
 * error pins the border to the danger color.
 */
export function useFieldFocus(
  colors: FieldColors,
  hasError: boolean,
  onFocus?: (event: FocusEvent) => void,
  onBlur?: (event: FocusEvent) => void,
) {
  const focus = useSharedValue(0);

  const handleFocus = useCallback(
    (event: FocusEvent) => {
      focus.set(withTiming(1, { duration: Durations.fast }));
      onFocus?.(event);
    },
    [focus, onFocus],
  );

  const handleBlur = useCallback(
    (event: FocusEvent) => {
      focus.set(withTiming(0, { duration: Durations.normal }));
      onBlur?.(event);
    },
    [focus, onBlur],
  );

  const boxStyle = useAnimatedStyle(() => ({
    borderColor: hasError ? colors.error : interpolateColor(focus.get(), [0, 1], [colors.border, colors.focus]),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(focus.get(), [0, 1], [colors.label, colors.labelFocused]),
  }));

  return { handleFocus, handleBlur, boxStyle, labelStyle };
}
