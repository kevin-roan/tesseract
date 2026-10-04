import { useCallback, useEffect, useRef, useState } from "react";

import { useEntrance } from "@/hooks/use-entrance";

/**
 * Entrance for rows that arrive after the list first showed up. Rows that were
 * already there, or that already played once (recycled on scroll), stay still.
 */
export function useFreshEntrance(keys: readonly number[], ready: boolean) {
  const entering = useEntrance(0, "tight");
  const [baseline, setBaseline] = useState<number | null>(null);
  const played = useRef(new Set<number>());

  if (ready && baseline === null) setBaseline(keys.reduce((max, key) => Math.max(max, key), -Infinity));

  useEffect(() => {
    if (baseline === null) return;
    for (const key of keys) if (key > baseline) played.current.add(key);
  }, [keys, baseline]);

  return useCallback(
    (key: number) => (baseline === null || key <= baseline || played.current.has(key) ? undefined : entering),
    [baseline, entering],
  );
}
