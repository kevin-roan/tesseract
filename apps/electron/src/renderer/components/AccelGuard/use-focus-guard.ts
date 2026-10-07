import { type RefObject, useEffect, useState } from "react";
import { useAccelGuard } from "./use-accel-guard";

export function useFocusWithin(ref: RefObject<HTMLElement | null>): boolean {
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onFocusIn = () => setFocused(true);
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      setFocused(next !== null && element.contains(next));
    };
    setFocused(element.contains(document.activeElement));
    element.addEventListener("focusin", onFocusIn);
    element.addEventListener("focusout", onFocusOut);
    return () => {
      element.removeEventListener("focusin", onFocusIn);
      element.removeEventListener("focusout", onFocusOut);
    };
  }, [ref]);
  return focused;
}

export function useAccelGuardWhileFocused(ref: RefObject<HTMLElement | null>): boolean {
  const focused = useFocusWithin(ref);
  useAccelGuard(focused);
  return focused;
}
