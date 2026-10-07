import { useIsPresent } from "motion/react";
import { useLayoutEffect, useRef } from "react";

const AUTOFOCUS_SELECTOR = "[autofocus], [data-autofocus]";
const FOCUS_TARGET_ATTRIBUTE = "data-presence-focus";

function isLiveLayer(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && !element.hasAttribute("inert");
}

function enteringLayer(layer: HTMLElement): HTMLElement | null {
  let next = layer.nextElementSibling;
  while (next && !isLiveLayer(next)) next = next.nextElementSibling;
  if (next) return next as HTMLElement;
  let previous = layer.previousElementSibling;
  while (previous && !isLiveLayer(previous)) previous = previous.previousElementSibling;
  return (previous as HTMLElement | null) ?? null;
}

function focusLayer(target: HTMLElement) {
  const preferred = target.querySelector<HTMLElement>(AUTOFOCUS_SELECTOR);
  if (preferred) {
    preferred.focus({ preventScroll: true });
    return;
  }
  if (!target.hasAttribute("tabindex")) {
    target.tabIndex = -1;
    target.setAttribute(FOCUS_TARGET_ATTRIBUTE, "");
  }
  target.focus({ preventScroll: true });
}

export function useExitInert<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const isPresent = useIsPresent();
  useLayoutEffect(() => {
    const layer = ref.current;
    if (isPresent || !layer) return;
    const hadFocus = layer.contains(document.activeElement);
    layer.setAttribute("inert", "");
    layer.setAttribute("aria-hidden", "true");
    if (!hadFocus) return;
    const target = enteringLayer(layer);
    if (target) focusLayer(target);
  }, [isPresent]);
  return ref;
}
