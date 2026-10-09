import { useCallback, useEffect, useRef } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from "react-native";

import { playHaptic } from "@/lib/haptics";

import type { IslandItem } from "../utils/format";

/** Keeps a paging scroll view on the focused task and reports the task each swipe settles on. */
export function useIslandPager(items: IslandItem[], focusedId: string | null, onFocus: (id: string) => void, pageWidth: number) {
  const ref = useRef<ScrollView>(null);
  const index = Math.max(0, items.findIndex((item) => item.id === focusedId));

  useEffect(() => {
    ref.current?.scrollTo({ x: index * pageWidth, animated: false });
  }, [index, pageWidth]);

  const settle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement } = event.nativeEvent;
      const width = layoutMeasurement.width || pageWidth;
      if (width <= 0) return;
      const page = Math.min(items.length - 1, Math.max(0, Math.round(contentOffset.x / width)));
      const next = items[page];
      if (!next || page === index) return;
      playHaptic("selection");
      onFocus(next.id);
    },
    [items, index, onFocus, pageWidth],
  );

  return { ref, index, offset: { x: index * pageWidth, y: 0 }, settle };
}
