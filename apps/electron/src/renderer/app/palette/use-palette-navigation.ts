import { useCallback, useState, type KeyboardEvent } from "react";

export type PaletteMove = "next" | "previous" | "first" | "last";

export function moveIndex(current: number, count: number, move: PaletteMove): number {
  if (count <= 0) return -1;
  if (move === "first") return 0;
  if (move === "last") return count - 1;
  const base = current < 0 ? (move === "next" ? -1 : 0) : current;
  return (base + (move === "next" ? 1 : -1) + count) % count;
}

export function keyToMove(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): PaletteMove | null {
  if (event.altKey || event.shiftKey) return null;
  if (event.key === "ArrowDown" && !event.ctrlKey) return event.metaKey ? "last" : "next";
  if (event.key === "ArrowUp" && !event.ctrlKey) return event.metaKey ? "first" : "previous";
  if (event.key === "PageDown") return "last";
  if (event.key === "PageUp") return "first";
  if (event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "n") return "next";
  if (event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "p") return "previous";
  return null;
}

interface NavigationState {
  resetKey: string;
  active: number;
  source: "keyboard" | "pointer";
}

export function usePaletteNavigation(count: number, resetKey: string, onSelect: (index: number) => void) {
  const [state, setState] = useState<NavigationState>({ resetKey, active: 0, source: "keyboard" });
  const current = state.resetKey === resetKey ? state : { resetKey, active: 0, source: "keyboard" as const };
  if (current !== state) setState(current);
  const active = count === 0 ? -1 : Math.min(Math.max(current.active, 0), count - 1);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.nativeEvent.isComposing) return;
      const move = keyToMove(event);
      if (move) {
        event.preventDefault();
        setState({ resetKey, active: moveIndex(active, count, move), source: "keyboard" });
        return;
      }
      if (event.key === "Enter" && active >= 0) {
        event.preventDefault();
        onSelect(active);
      }
    },
    [active, count, onSelect, resetKey],
  );

  const hover = useCallback((index: number) => setState({ resetKey, active: index, source: "pointer" }), [resetKey]);

  return { active, source: current.source, onKeyDown, hover };
}
