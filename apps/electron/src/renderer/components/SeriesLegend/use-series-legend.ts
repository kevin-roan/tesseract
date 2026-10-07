import { useCallback, useMemo } from "react";
import { toggleHidden } from "./model";
import type { LegendItem } from "./types";

export function useSeriesLegend(items: readonly LegendItem[], hidden: readonly string[], onChange?: (hidden: string[]) => void) {
  const keys = useMemo(() => items.map((item) => item.key), [items]);
  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  const toggle = useCallback(
    (key: string) => {
      const next = toggleHidden(keys, hidden, key);
      if (next.length !== hidden.length || next.some((item, index) => item !== hidden[index])) onChange?.(next);
    },
    [keys, hidden, onChange],
  );
  return { isActive: (key: string) => !hiddenSet.has(key), toggle };
}
