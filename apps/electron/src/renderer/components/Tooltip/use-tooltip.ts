import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent } from "react";
import {
  TOOLTIP_GAP_PX,
  TOOLTIP_OPEN_DELAY_MS,
  TOOLTIP_SKIP_DELAY_MS,
  TOOLTIP_VIEWPORT_MARGIN_PX,
} from "./constants";
import { computeTooltipPosition, type TooltipPlacement, type TooltipPosition } from "./position";

let lastHiddenAt = Number.NEGATIVE_INFINITY;
let visibleCount = 0;

export const TOOLTIP_ANCHOR_ATTRIBUTE = "data-tooltip-anchor";

function anchorElement(wrapper: HTMLElement | null): Element | null {
  let element = wrapper?.firstElementChild ?? null;
  while (element?.hasAttribute(TOOLTIP_ANCHOR_ATTRIBUTE)) element = element.firstElementChild;
  return element;
}

function isFocusVisible(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return false;
  }
}

export interface UseTooltipOptions {
  enabled: boolean;
  placement: TooltipPlacement;
  forcedOpen?: boolean;
  delayMs?: number;
  shouldShow?: (anchor: Element) => boolean;
}

export function useTooltip({ enabled, placement, forcedOpen, delayMs = TOOLTIP_OPEN_DELAY_MS, shouldShow }: UseTooltipOptions) {
  const id = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const open = enabled && (forcedOpen ?? active);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const show = useCallback(() => {
    if (!enabled) return;
    const anchor = anchorElement(anchorRef.current);
    if (shouldShow && (!anchor || !shouldShow(anchor))) return;
    clearTimer();
    const sinceHidden = performance.now() - lastHiddenAt;
    const recentlyShown = visibleCount > 0 || (sinceHidden >= 0 && sinceHidden < TOOLTIP_SKIP_DELAY_MS);
    if (recentlyShown) {
      setActive(true);
      return;
    }
    timer.current = setTimeout(() => setActive(true), delayMs);
  }, [enabled, clearTimer, delayMs, shouldShow]);

  const hide = useCallback(() => {
    clearTimer();
    setActive(false);
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  useEffect(() => {
    if (!open) return;
    visibleCount += 1;
    const anchor = anchorElement(anchorRef.current);
    anchor?.setAttribute("aria-describedby", id);
    return () => {
      visibleCount -= 1;
      lastHiddenAt = performance.now();
      anchor?.removeAttribute("aria-describedby");
    };
  }, [open, id]);

  const measure = useCallback(() => {
    const anchor = anchorElement(anchorRef.current);
    const floating = floatingRef.current;
    if (!anchor || !floating) return;
    const rect = anchor.getBoundingClientRect();
    setPosition(
      computeTooltipPosition(
        { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        { width: floating.offsetWidth, height: floating.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
        placement,
        TOOLTIP_GAP_PX,
        TOOLTIP_VIEWPORT_MARGIN_PX,
      ),
    );
  }, [placement]);

  useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onViewportChange = forcedOpen ? measure : hide;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !forcedOpen) hide();
    };
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("keydown", onKey);
    let cancelled = false;
    if (forcedOpen) void document.fonts?.ready.then(() => !cancelled && measure());
    return () => {
      cancelled = true;
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, forcedOpen, hide, measure]);

  const anchorProps = {
    ref: anchorRef,
    [TOOLTIP_ANCHOR_ATTRIBUTE]: "",
    onPointerEnter: show,
    onPointerLeave: hide,
    onPointerDown: hide,
    onFocus: (event: FocusEvent<HTMLSpanElement>) => {
      if (isFocusVisible(event.target)) show();
    },
    onBlur: hide,
  };

  return { id, open, position, anchorProps, floatingRef };
}
