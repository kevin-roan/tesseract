import { useCallback, type KeyboardEvent } from "react";

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const PREVIOUS_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

export function useRovingChoice<T extends string>(ids: readonly T[], value: T | null, select: (id: T) => void) {
  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (ids.length === 0) return;
      const current = value === null ? -1 : ids.indexOf(value);
      let next: number | null = null;
      if (NEXT_KEYS.has(event.key)) next = (current + 1) % ids.length;
      else if (PREVIOUS_KEYS.has(event.key)) next = (current - 1 + ids.length) % ids.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = ids.length - 1;
      if (next === null) return;
      event.preventDefault();
      const id = ids[next];
      if (id === undefined) return;
      select(id);
      const buttons = event.currentTarget.querySelectorAll<HTMLElement>("[role='radio']:not(:disabled):not([aria-disabled='true'])");
      buttons[next]?.focus();
    },
    [ids, value, select],
  );
}
