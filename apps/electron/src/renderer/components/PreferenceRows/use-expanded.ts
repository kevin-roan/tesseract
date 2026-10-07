import { useCallback, useState } from "react";

export function useExpanded(controlled: boolean | undefined, initial: boolean, onChange?: (expanded: boolean) => void) {
  const [local, setLocal] = useState(initial);
  const expanded = controlled ?? local;
  const toggle = useCallback(() => {
    const next = !expanded;
    if (controlled === undefined) setLocal(next);
    onChange?.(next);
  }, [controlled, expanded, onChange]);
  return { expanded, toggle };
}
