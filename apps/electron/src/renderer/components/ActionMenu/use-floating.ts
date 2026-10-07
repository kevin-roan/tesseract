import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { MENU_INITIAL_SELECTOR, MENU_ITEM_SELECTOR, VIEWPORT_MARGIN_PX } from "./constants";
import { computeFloatingPosition, type AnchorRect, type FloatingPosition } from "./model";

export function useFloatingPosition(anchor: AnchorRect, offset: number, ref: RefObject<HTMLElement | null>) {
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setPosition(
      computeFloatingPosition({
        anchor,
        width: element.offsetWidth,
        height: element.offsetHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        offset,
        margin: VIEWPORT_MARGIN_PX,
      }),
    );
  }, [anchor, offset, ref]);
  return position;
}

export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  ignoreRef?: RefObject<HTMLElement | null>,
  enabled = true,
) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!enabled) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (ref.current?.contains(target) || ignoreRef?.current?.contains(target)) return;
      closeRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeRef.current();
    };
    const onViewportChange = () => closeRef.current();
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("blur", onViewportChange);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("blur", onViewportChange);
    };
  }, [ref, ignoreRef, enabled]);
}

export function useFocusReturn(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const container = ref.current;
    const initial =
      container?.querySelector<HTMLElement>(MENU_INITIAL_SELECTOR) ?? container?.querySelector<HTMLElement>(MENU_ITEM_SELECTOR);
    (initial ?? container)?.focus({ preventScroll: true });
    return () => {
      const active = document.activeElement;
      const focusLost = !active || active === document.body || (container?.contains(active) ?? false);
      if (focusLost && previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [ref]);
}
