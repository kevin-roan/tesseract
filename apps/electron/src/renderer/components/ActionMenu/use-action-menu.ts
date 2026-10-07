import { useCallback, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { LONG_PRESS_MS, LONG_PRESS_TOLERANCE_PX } from "./constants";
import { centerAnchor, pointAnchor, rectAnchor, type AnchorRect } from "./model";

export interface MenuPoint {
  x: number;
  y: number;
}

export function useActionMenu() {
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const openAt = useCallback((point: MenuPoint) => setAnchor(pointAnchor(point.x, point.y)), []);
  const openBelow = useCallback((element: Element) => setAnchor(rectAnchor(element.getBoundingClientRect())), []);
  const close = useCallback(() => setAnchor(null), []);
  return { anchor, open: anchor !== null, openAt, openBelow, close };
}

export interface ContextMenuOptions {
  disabled?: boolean;
}

export function useContextMenu(onRequest: (point: MenuPoint) => void, { disabled = false }: ContextMenuOptions = {}) {
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const requestRef = useRef(onRequest);
  requestRef.current = onRequest;

  const cancelPress = useCallback(() => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  }, []);

  const onContextMenu = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (disabled) return;
      event.preventDefault();
      cancelPress();
      requestRef.current({ x: event.clientX, y: event.clientY });
    },
    [cancelPress, disabled],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (disabled) return;
      const isMenuKey = event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey);
      if (!isMenuKey) return;
      event.preventDefault();
      const anchor = centerAnchor(event.currentTarget.getBoundingClientRect());
      requestRef.current({ x: anchor.x, y: anchor.y });
    },
    [disabled],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (disabled || event.pointerType !== "touch") return;
      cancelPress();
      const { clientX: x, clientY: y } = event;
      press.current = {
        x,
        y,
        timer: setTimeout(() => {
          press.current = null;
          requestRef.current({ x, y });
        }, LONG_PRESS_MS),
      };
    },
    [cancelPress, disabled],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const current = press.current;
      if (!current) return;
      if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > LONG_PRESS_TOLERANCE_PX) cancelPress();
    },
    [cancelPress],
  );

  return { onContextMenu, onKeyDown, onPointerDown, onPointerMove, onPointerUp: cancelPress, onPointerCancel: cancelPress };
}
