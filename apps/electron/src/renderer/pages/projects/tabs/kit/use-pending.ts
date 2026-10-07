import { useCallback, useRef, useState } from "react";

export function usePendingSet() {
  const ref = useRef(new Set<string>());
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const set = useCallback((id: string, on: boolean) => {
    if (on) ref.current.add(id);
    else ref.current.delete(id);
    setPending(new Set(ref.current));
  }, []);
  const has = useCallback((id: string) => ref.current.has(id), []);
  return { pending, set, has };
}
