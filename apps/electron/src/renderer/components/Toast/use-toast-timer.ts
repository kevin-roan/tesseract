import { useCallback, useEffect, useRef, useState } from "react";

export function useToastTimer(id: number | null, timeoutMs: number, onExpire: (id: number) => void) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(timeoutMs);
  const startedAt = useRef(0);

  useEffect(() => {
    remaining.current = timeoutMs;
    setPaused(false);
  }, [id, timeoutMs]);

  useEffect(() => {
    if (id === null || paused || timeoutMs <= 0) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => onExpire(id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [id, paused, timeoutMs, onExpire]);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => setPaused(false), []);
  return { pause, resume };
}
