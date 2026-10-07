import { useEffect, useState } from "react";
import { CLOCK_TICK_MS } from "./constants";

export function useNow(active: boolean, intervalMs: number = CLOCK_TICK_MS): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [active, intervalMs]);
  return now;
}
