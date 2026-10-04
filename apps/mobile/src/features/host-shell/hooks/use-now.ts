import { useEffect, useState } from "react";

import { COUNTDOWN_TICK_MS } from "../utils/constants";

export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS);
    return () => clearInterval(timer);
  }, [active]);

  return now;
}
