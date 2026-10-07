import { useCallback, type KeyboardEvent } from "react";
import { MENU_ITEM_SELECTOR } from "./constants";

export function useMenuKeyboard(onClose: () => void, enabled = true) {
  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (!enabled) return;
      if (event.key === "Tab") {
        event.preventDefault();
        onClose();
        return;
      }
      const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR));
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement as HTMLElement);
      let next: number | null = null;
      if (event.key === "ArrowDown") next = current < 0 ? 0 : (current + 1) % items.length;
      else if (event.key === "ArrowUp") next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = items.length - 1;
      if (next === null) return;
      event.preventDefault();
      items[next]?.focus();
    },
    [onClose, enabled],
  );
}
