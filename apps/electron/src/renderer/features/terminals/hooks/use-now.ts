import { useEffect, useState } from "react";
import { useWindowVisible } from "../../../app/connection";
import { TIME_TICK_MS } from "../constants";

export function useNow(intervalMs: number = TIME_TICK_MS): number {
  const visible = useWindowVisible();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!visible) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, visible]);
  return now;
}
