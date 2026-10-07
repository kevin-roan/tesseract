import { useCallback, type KeyboardEvent } from "react";

const NEXT_KEYS = new Set(["ArrowDown", "ArrowRight"]);
const PREVIOUS_KEYS = new Set(["ArrowUp", "ArrowLeft"]);

export function useRadioKeys<T extends string>(ids: readonly T[], select: (id: T) => void) {
  return useCallback(
    (event: KeyboardEvent<HTMLElement>, current: T) => {
      const step = NEXT_KEYS.has(event.key) ? 1 : PREVIOUS_KEYS.has(event.key) ? -1 : 0;
      if (step === 0 || ids.length === 0) return;
      event.preventDefault();
      const index = ids.indexOf(current);
      const next = ids[(index + step + ids.length) % ids.length];
      if (next === undefined) return;
      select(next);
      const rows = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>("[role='radio']:not([aria-disabled='true'])");
      rows?.[ids.indexOf(next)]?.focus();
    },
    [ids, select],
  );
}
