import { useEffect, useState } from "react";
import { useWindowVisible } from "../../../app/connection";
import { TIME_TICK_MS } from "../constants";
import { nowSeconds } from "../format";

export function useNow(intervalMs: number = TIME_TICK_MS, enabled = true): number {
  const visible = useWindowVisible();
  const [now, setNow] = useState(nowSeconds);
  useEffect(() => {
    if (!visible || !enabled) return undefined;
    setNow(nowSeconds());
    const timer = setInterval(() => setNow(nowSeconds()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, visible, enabled]);
  return now;
}
