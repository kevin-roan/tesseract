import { useCallback, useState } from "react";
import type { AccessibilityActionEvent, GestureResponderEvent } from "react-native";

import { indexAtX } from "../utils/series";

/**
 * Tap-and-drag inspection for a chart of `count` evenly spaced columns: the pointer snaps to the nearest column.
 * Screen readers step through the same columns with increment/decrement.
 */
export function useChartSelection(count: number, width: number) {
  const [selected, setSelected] = useState<number | null>(null);

  const pick = useCallback(
    (event: GestureResponderEvent) => setSelected(indexAtX(event.nativeEvent.locationX, width, count)),
    [width, count],
  );

  const toggle = useCallback(
    (event: GestureResponderEvent) => {
      const index = indexAtX(event.nativeEvent.locationX, width, count);
      setSelected((current) => (current === index ? null : index));
    },
    [width, count],
  );

  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (count === 0) return;
      const step = event.nativeEvent.actionName === "increment" ? 1 : -1;
      setSelected((current) => Math.min(count - 1, Math.max(0, (current ?? (step > 0 ? -1 : count)) + step)));
    },
    [count],
  );

  return {
    selected: selected !== null && selected < count ? selected : null,
    handlers: {
      onStartShouldSetResponder: () => true,
      onMoveShouldSetResponder: () => true,
      onResponderTerminationRequest: () => true,
      onResponderGrant: toggle,
      onResponderMove: pick,
      onAccessibilityAction,
    },
  };
}
