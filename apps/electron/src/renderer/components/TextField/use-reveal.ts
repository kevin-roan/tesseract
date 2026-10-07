import { useCallback, useState } from "react";

export function useReveal(initial = false) {
  const [revealed, setRevealed] = useState(initial);
  const toggle = useCallback(() => setRevealed((value) => !value), []);
  return { revealed, toggle };
}
