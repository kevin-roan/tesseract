import { useCallback, useEffect, useRef, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { linearTiming } from "@/lib/motion";

type SegmentLayout = { x: number; width: number };

/** Slides a shared indicator under the selected segment once every segment has been measured. */
export function useSegmentIndicator(selectedIndex: number) {
  const reduced = useReducedMotion();
  const [layouts, setLayouts] = useState<Record<number, SegmentLayout>>({});
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const placed = useRef(false);
  const target = layouts[selectedIndex];

  useEffect(() => {
    if (!target) return;
    if (!placed.current || reduced) {
      x.set(target.x);
      width.set(target.width);
      placed.current = true;
      return;
    }
    x.set(withTiming(target.x, linearTiming()));
    width.set(withTiming(target.width, linearTiming()));
  }, [target, reduced, x, width]);

  const onLayout = useCallback(
    (index: number) => (event: LayoutChangeEvent) => {
      const { x: left, width: size } = event.nativeEvent.layout;
      setLayouts((prev) => {
        const current = prev[index];
        if (current && current.x === left && current.width === size) return prev;
        return { ...prev, [index]: { x: left, width: size } };
      });
    },
    [],
  );

  const style = useAnimatedStyle(() => ({
    width: width.get(),
    transform: [{ translateX: x.get() }],
  }));

  return { style, onLayout, ready: target != null };
}
