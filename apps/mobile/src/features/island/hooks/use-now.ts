import { useEffect, useState } from "react";

import { ELAPSED_TICK_MS } from "../utils/constants";

/** A timestamp that ticks while `active`, for elapsed-time labels. */
export function useNow(active: boolean, intervalMs: number = ELAPSED_TICK_MS): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [active, intervalMs]);

  return now;
}
