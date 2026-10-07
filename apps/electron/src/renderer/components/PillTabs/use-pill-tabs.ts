import { useCallback, useRef, type KeyboardEvent } from "react";
import type { PillTab } from "./types";

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const PREVIOUS_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

export function nextTabId(tabs: readonly PillTab[], current: string, key: string): string | null {
  const count = tabs.length;
  if (count === 0) return null;
  const index = Math.max(0, tabs.findIndex((tab) => tab.id === current));
  let target: number | null = null;
  if (NEXT_KEYS.has(key)) target = (index + 1) % count;
  else if (PREVIOUS_KEYS.has(key)) target = (index - 1 + count) % count;
  else if (key === "Home") target = 0;
  else if (key === "End") target = count - 1;
  return target === null ? null : (tabs[target]?.id ?? null);
}

export function usePillTabs(tabs: readonly PillTab[], selected: string, onChange: (id: string) => void) {
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  const select = useCallback(
    (id: string) => {
      if (id !== selected) onChange(id);
    },
    [selected, onChange],
  );

  const register = useCallback(
    (id: string) => (element: HTMLButtonElement | null) => {
      if (element) buttons.current.set(id, element);
      else buttons.current.delete(id);
    },
    [],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const target = nextTabId(tabs, selected, event.key);
      if (target === null) return;
      event.preventDefault();
      select(target);
      buttons.current.get(target)?.focus();
    },
    [tabs, selected, select],
  );

  return { select, register, onKeyDown };
}
