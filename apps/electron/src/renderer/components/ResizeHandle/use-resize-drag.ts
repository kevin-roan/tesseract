import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { RESIZE_CURSOR, RESIZE_KEY_STEP, SIDEBAR_WIDTH } from "./constants";
import { keyboardWidth, resizeKeys, resizeWidth, type ResizeAxis, type WidthBounds } from "./model";

export interface ResizeDragOptions {
  width: number;
  zoom?: number;
  bounds?: WidthBounds;
  defaultWidth?: number;
  axis?: ResizeAxis;
  reverse?: boolean;
  onResize(width: number): void;
  onCommit(width: number): void;
}

interface DragSession {
  pointerId: number;
  start: number;
  startWidth: number;
  lastWidth: number;
}

function lockDocument(axis: ResizeAxis): () => void {
  const body = document.body;
  const previous = { userSelect: body.style.userSelect, cursor: body.style.cursor };
  body.style.userSelect = "none";
  body.style.cursor = RESIZE_CURSOR[axis];
  return () => {
    body.style.userSelect = previous.userSelect;
    body.style.cursor = previous.cursor;
  };
}

export function useResizeDrag({ width, zoom = 1, bounds = SIDEBAR_WIDTH, defaultWidth = SIDEBAR_WIDTH.default, axis = "x", reverse = false, onResize, onCommit }: ResizeDragOptions) {
  const pointerAt = (event: PointerEvent<HTMLElement>) => (axis === "x" ? event.clientX : event.clientY);
  const session = useRef<DragSession | null>(null);
  const unlock = useRef<(() => void) | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => unlock.current?.(), []);

  const finish = (event: PointerEvent<HTMLElement>) => {
    const current = session.current;
    if (!current || current.pointerId !== event.pointerId) return;
    session.current = null;
    unlock.current?.();
    unlock.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    onCommit(current.lastWidth);
  };

  const commit = (next: number) => {
    onResize(next);
    onCommit(next);
  };

  return {
    dragging,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        session.current = { pointerId: event.pointerId, start: pointerAt(event), startWidth: width, lastWidth: width };
        unlock.current = lockDocument(axis);
        setDragging(true);
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const current = session.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const offset = pointerAt(event) - current.start;
        const next = resizeWidth(current.startWidth, reverse ? -offset : offset, zoom, bounds);
        if (next === current.lastWidth) return;
        current.lastWidth = next;
        onResize(next);
      },
      onPointerUp: finish,
      onPointerCancel: finish,
      onDoubleClick: () => commit(defaultWidth),
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        const next = event.key === "Enter" ? defaultWidth : keyboardWidth(event.key, width, RESIZE_KEY_STEP, bounds, resizeKeys(axis, reverse));
        if (next === null) return;
        event.preventDefault();
        commit(next);
      },
    },
  };
}
