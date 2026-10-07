import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject, type WheelEvent } from "react";
import { OVERLAY_SCROLL_ATTRIBUTE, OVERLAY_SCROLLBAR } from "./constants";
import { sameBox, scrollPerThumbPixel, thumbLength, thumbOffset, wheelPixels, type RailBox } from "./model";

interface DragState {
  pointerId: number;
  startY: number;
  startScroll: number;
  ratio: number;
}

export function useOverlayScrollbar(target: RefObject<HTMLElement | null>) {
  const thumbRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<RailBox | null>(null);
  const [active, setActive] = useState(false);
  const [dragging, setDragging] = useState(false);
  const boxRef = useRef<RailBox | null>(null);
  const drag = useRef<DragState | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const place = useCallback(() => {
    const element = target.current;
    const thumb = thumbRef.current;
    const current = boxRef.current;
    if (!element || !thumb || !current) return;
    thumb.style.transform = `translateY(${thumbOffset(element, current.thumb)}px)`;
  }, [target]);

  const measure = useCallback(() => {
    const element = target.current;
    if (!element) return;
    const thumb = thumbLength(element);
    const next =
      thumb === null
        ? null
        : {
            top: element.offsetTop + element.clientTop,
            left: element.offsetLeft + element.clientLeft,
            width: element.clientWidth,
            height: element.clientHeight,
            thumb,
          };
    if (!sameBox(boxRef.current, next)) {
      boxRef.current = next;
      setBox(next);
    }
    place();
  }, [target, place]);

  const flash = useCallback(() => {
    if (!boxRef.current) return;
    setActive(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      hideTimer.current = null;
      if (!drag.current) setActive(false);
    }, OVERLAY_SCROLLBAR.hideDelayMs);
  }, []);

  useLayoutEffect(() => {
    place();
  }, [box, place]);

  useEffect(() => {
    const element = target.current;
    if (!element) return;
    element.setAttribute(OVERLAY_SCROLL_ATTRIBUTE, "");
    measure();
    const onScroll = () => {
      place();
      flash();
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    element.addEventListener("pointermove", flash, { passive: true });
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    const observeChildren = () => {
      if (!resize) return;
      resize.disconnect();
      resize.observe(element);
      for (const child of Array.from(element.children)) resize.observe(child);
    };
    observeChildren();
    const mutations =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            observeChildren();
            measure();
          });
    mutations?.observe(element, { childList: true });
    return () => {
      element.removeAttribute(OVERLAY_SCROLL_ATTRIBUTE);
      element.removeEventListener("scroll", onScroll);
      element.removeEventListener("pointermove", flash);
      resize?.disconnect();
      mutations?.disconnect();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [target, measure, place, flash]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const element = target.current;
      const current = boxRef.current;
      if (!element || !current || event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      drag.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startScroll: element.scrollTop,
        ratio: scrollPerThumbPixel(element, current.thumb),
      };
      setDragging(true);
      setActive(true);
    },
    [target],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const element = target.current;
      const state = drag.current;
      if (!element || !state || state.pointerId !== event.pointerId) return;
      element.scrollTop = state.startScroll + (event.clientY - state.startY) * state.ratio;
    },
    [target],
  );

  const endDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (drag.current?.pointerId !== event.pointerId) return;
      drag.current = null;
      setDragging(false);
      flash();
    },
    [flash],
  );

  const onWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      const element = target.current;
      if (!element) return;
      element.scrollTop += wheelPixels(event, element.clientHeight);
    },
    [target],
  );

  return {
    box,
    visible: box !== null && (active || dragging),
    dragging,
    thumbRef,
    thumbProps: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onPointerEnter: flash, onWheel },
  };
}
