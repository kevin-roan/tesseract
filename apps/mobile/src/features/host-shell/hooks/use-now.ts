import { useEffect, useState } from "react";

import { COUNTDOWN_TICK_MS } from "../utils/constants";

export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    // Catch up right away after a pause instead of showing the stale time for a whole tick.
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, COUNTDOWN_TICK_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [active]);

  return now;
}
