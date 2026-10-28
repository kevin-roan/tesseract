import type { IssueStatus } from "@tesseract/protocol";
import { useCallback, useMemo, useRef, useState, type DragEvent } from "react";
import type { DropPosition } from "../types";

export interface BoardDrag {
  draggingId: string | null;
  over: DropPosition | null;
  start(id: string, event: DragEvent): void;
  overColumn(status: IssueStatus, event: DragEvent): void;
  overCard(status: IssueStatus, id: string, nextId: string | null, event: DragEvent<HTMLElement>): void;
  drop(event: DragEvent): void;
  end(): void;
}

const lowerHalf = (event: DragEvent<HTMLElement>) => {
  const rect = event.currentTarget.getBoundingClientRect();
  return rect.height > 0 && event.clientY > rect.top + rect.height / 2;
};

const samePosition = (a: DropPosition | null, b: DropPosition) => a?.status === b.status && a.beforeId === b.beforeId;

export function useBoardDrag(onDrop: (id: string, target: DropPosition) => void): BoardDrag {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [over, setOver] = useState<DropPosition | null>(null);
  const state = useRef<{ id: string | null; over: DropPosition | null }>({ id: null, over: null });
  const latestDrop = useRef(onDrop);
  latestDrop.current = onDrop;

  const hover = useCallback((target: DropPosition) => {
    if (samePosition(state.current.over, target)) return;
    state.current.over = target;
    setOver(target);
  }, []);

  const end = useCallback(() => {
    state.current = { id: null, over: null };
    setDraggingId(null);
    setOver(null);
  }, []);

  const start = useCallback((id: string, event: DragEvent) => {
    event.dataTransfer?.setData("text/plain", id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    state.current = { id, over: null };
    setDraggingId(id);
  }, []);

  const overColumn = useCallback(
    (status: IssueStatus, event: DragEvent) => {
      if (!state.current.id) return;
      event.preventDefault();
      if (state.current.over?.status !== status) hover({ status, beforeId: null });
    },
    [hover],
  );

  const overCard = useCallback(
    (status: IssueStatus, id: string, nextId: string | null, event: DragEvent<HTMLElement>) => {
      if (!state.current.id) return;
      event.preventDefault();
      event.stopPropagation();
      hover({ status, beforeId: lowerHalf(event) ? nextId : id });
    },
    [hover],
  );

  const drop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const { id, over: target } = state.current;
      if (id && target) latestDrop.current(id, target);
      end();
    },
    [end],
  );

  return useMemo(() => ({ draggingId, over, start, overColumn, overCard, drop, end }), [draggingId, over, start, overColumn, overCard, drop, end]);
}
