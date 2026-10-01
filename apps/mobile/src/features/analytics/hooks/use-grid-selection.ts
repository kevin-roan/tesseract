import { useCallback, useState } from "react";
import type { GestureResponderEvent } from "react-native";

export type GridPoint = { row: number; column: number };

export function cellAt(x: number, y: number, width: number, height: number, rows: number, columns: number): GridPoint | null {
  if (width <= 0 || height <= 0 || x < 0 || y < 0 || x > width || y > height) return null;
  return {
    row: Math.min(rows - 1, Math.floor((y / height) * rows)),
    column: Math.min(columns - 1, Math.floor((x / width) * columns)),
  };
}

/** Tap-to-inspect for a rows × columns grid drawn in a `width` × `height` box. Tapping the same cell again clears it. */
export function useGridSelection(rows: number, columns: number, width: number, height: number) {
  const [selected, setSelected] = useState<GridPoint | null>(null);

  const locate = useCallback(
    (event: GestureResponderEvent) =>
      cellAt(event.nativeEvent.locationX, event.nativeEvent.locationY, width, height, rows, columns),
    [width, height, rows, columns],
  );

  const onResponderGrant = useCallback(
    (event: GestureResponderEvent) => {
      const point = locate(event);
      setSelected((current) =>
        point && current && current.row === point.row && current.column === point.column ? null : point,
      );
    },
    [locate],
  );

  const onResponderMove = useCallback(
    (event: GestureResponderEvent) => {
      const point = locate(event);
      if (point) setSelected(point);
    },
    [locate],
  );

  return {
    selected,
    handlers: {
      onStartShouldSetResponder: () => true,
      onMoveShouldSetResponder: () => true,
      onResponderTerminationRequest: () => true,
      onResponderGrant,
      onResponderMove,
    },
  };
}
