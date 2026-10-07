import { useEffect, useState } from "react";
import { COUNTDOWN_TICK_MS } from "../constants";

export function useNow(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS);
    return () => clearInterval(timer);
  }, [ticking]);
  return now;
}
