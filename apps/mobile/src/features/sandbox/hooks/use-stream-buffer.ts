import { useCallback, useEffect, useRef, useState } from "react";

import { STREAM_FLUSH_INTERVAL_MS } from "../utils/constants";

type Merge<T> = (current: T[], incoming: T[]) => T[];

type Keyed<T> = { key: string; items: T[] };

export function useStreamBuffer<T>(key: string, merge: Merge<T>) {
  const [state, setState] = useState<Keyed<T>>({ key, items: [] });
  const pending = useRef<{ key: string; items: T[] }>({ key, items: [] });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mergeRef = useRef(merge);

  useEffect(() => {
    mergeRef.current = merge;
  }, [merge]);

  const flush = useCallback(() => {
    timer.current = null;
    const batch = pending.current;
    pending.current = { key: batch.key, items: [] };
    if (batch.items.length === 0) return;
    setState((current) => {
      const base = current.key === batch.key ? current.items : [];
      return { key: batch.key, items: mergeRef.current(base, batch.items) };
    });
  }, []);

  const push = useCallback(
    (bufferKey: string, items: T[]) => {
      if (pending.current.key !== bufferKey) pending.current = { key: bufferKey, items: [] };
      pending.current.items.push(...items);
      timer.current ??= setTimeout(flush, STREAM_FLUSH_INTERVAL_MS);
    },
    [flush],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { items: state.key === key ? state.items : [], push };
}
