import { useCallback, useEffect, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { linearTiming } from "@/lib/motion";
import { ChartMotion } from "@/theme";

/** Sweeps a clip open from the left whenever `signature` changes, revealing the strip underneath. */
export function useFillReveal(signature: string) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (reduced) {
      progress.set(1);
      return;
    }
    progress.set(0);
    progress.set(withTiming(1, linearTiming(ChartMotion.reveal)));
  }, [signature, reduced, progress]);

  const onLayout = useCallback((event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width), []);

  const clipStyle = useAnimatedStyle(() => ({ width: width * progress.get() }));

  return { width, onLayout, clipStyle };
}
