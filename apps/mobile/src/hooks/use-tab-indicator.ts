import { useCallback } from 'react';
import type { LayoutRectangle } from 'react-native';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { linearTiming } from '@/lib/motion';

/** Slides a highlight under whichever tab reports itself focused. */
export function useTabIndicator() {
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const placed = useSharedValue(false);

  const moveTo = useCallback(
    (layout: LayoutRectangle) => {
      if (!placed.value) {
        x.value = layout.x;
        width.value = layout.width;
        placed.value = true;
        return;
      }
      x.value = withTiming(layout.x, linearTiming());
      width.value = withTiming(layout.width, linearTiming());
    },
    [x, width, placed],
  );

  const style = useAnimatedStyle(() => ({
    opacity: placed.value ? 1 : 0,
    width: width.value,
    transform: [{ translateX: x.value }],
  }));

  return { moveTo, style };
}
