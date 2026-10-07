import { useEffect, useId, useRef, type RefObject } from "react";
import { AUTO_FOCUS_SELECTOR, DEFAULT_SELECTOR, FOCUSABLE_SELECTOR } from "./constants";
import { FLOATING_LAYER_ATTRIBUTE } from "../ActionMenu/constants";
import { isTopDialog, pushDialog } from "./dialog-stack";

export type InitialFocus = "auto" | "none" | { selector: string } | RefObject<HTMLElement | null>;

export interface DialogBehaviorOptions {
  active: boolean;
  sheetRef: RefObject<HTMLElement | null>;
  onClose(): void;
  initialFocus?: InitialFocus;
}

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.closest("[inert]") && element.getAttribute("aria-hidden") !== "true",
  );
}

function focusWithin(sheet: HTMLElement, target: HTMLElement | null) {
  target?.focus();
  if (document.activeElement !== target || !target) sheet.focus();
}

function focusInitial(sheet: HTMLElement | null, initialFocus: InitialFocus) {
  if (!sheet || initialFocus === "none") return;
  if (typeof initialFocus === "object") {
    focusWithin(sheet, "selector" in initialFocus ? sheet.querySelector<HTMLElement>(initialFocus.selector) : initialFocus.current);
    return;
  }
  focusWithin(sheet, sheet.querySelector<HTMLElement>(AUTO_FOCUS_SELECTOR) ?? sheet.querySelector<HTMLElement>(DEFAULT_SELECTOR));
}

function trapTab(event: KeyboardEvent, sheet: HTMLElement | null) {
  if (!sheet) return;
  const items = focusables(sheet);
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) {
    event.preventDefault();
    sheet.focus();
    return;
  }
  const current = document.activeElement;
  const inside = current instanceof Node && sheet.contains(current);
  if (!inside) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && current === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && current === last) {
    event.preventDefault();
    first.focus();
  }
}

function floatingLayerOpen(): boolean {
  return document.querySelector(`[${FLOATING_LAYER_ATTRIBUTE}]`) !== null;
}

export function useDialogBehavior({ active, sheetRef, onClose, initialFocus = "auto" }: DialogBehaviorOptions): string {
  const id = useId();
  const latest = useRef({ onClose, initialFocus });

  useEffect(() => {
    latest.current = { onClose, initialFocus };
  });

  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const release = pushDialog(id);
    focusInitial(sheetRef.current, latest.current.initialFocus);
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopDialog(id) || floatingLayerOpen()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        latest.current.onClose();
      } else if (event.key === "Tab") {
        trapTab(event, sheetRef.current);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      release();
      if (previous?.isConnected) previous.focus();
    };
  }, [active, id, sheetRef]);

  return id;
}
