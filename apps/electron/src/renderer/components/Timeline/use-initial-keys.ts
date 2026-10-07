import { useState, type Key } from "react";

export function useInitialKeys(keys: readonly Key[], resetKey: unknown): ReadonlySet<Key> {
  const [baseline, setBaseline] = useState(() => ({ resetKey, keys: new Set(keys) }));
  if (!Object.is(baseline.resetKey, resetKey)) {
    const next = { resetKey, keys: new Set(keys) };
    setBaseline(next);
    return next.keys;
  }
  return baseline.keys;
}
