import { useEffect } from "react";
import { FOOTER_KEY_SELECTORS } from "./constants";
import { isEditableTarget } from "./model";

function clickIn(footer: HTMLElement, selector: string): boolean {
  const button = footer.querySelector<HTMLButtonElement>(selector);
  if (!button) return false;
  button.click();
  return true;
}

export function useFooterKeys(footer: HTMLElement | null): void {
  useEffect(() => {
    if (!footer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (document.querySelector(FOOTER_KEY_SELECTORS.modal)) return;
      if (event.key === "Enter") {
        if (isEditableTarget(event.target, FOOTER_KEY_SELECTORS.interactive)) return;
        if (clickIn(footer, FOOTER_KEY_SELECTORS.primary)) event.preventDefault();
      } else if (event.key === "Escape") {
        if (clickIn(footer, FOOTER_KEY_SELECTORS.back)) event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [footer]);
}
