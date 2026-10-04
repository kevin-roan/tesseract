import { useCallback } from "react";
import { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { linearTiming } from "@/lib/motion";
import { Durations, PressScale } from "@/theme";

/**
 * Press feedback: the element sinks slightly while held and
 * settles back on release. Spread `handlers` onto a Pressable and put
 * `style` on the Animated view that should move.
 */
export function usePressScale(depth: keyof typeof PressScale = "card") {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  const target = PressScale[depth];

  const onPressIn = useCallback(() => {
    pressed.set(withTiming(1, linearTiming(Durations.fastest)));
  }, [pressed]);
  const onPressOut = useCallback(() => {
    pressed.set(withTiming(0, linearTiming(Durations.fast)));
  }, [pressed]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: reduced ? 1 : 1 - (1 - target) * pressed.value }],
  }));

  return { style, handlers: { onPressIn, onPressOut } };
}
