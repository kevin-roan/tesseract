import { useEffect, useRef, type RefObject } from "react";
import { MODAL_SELECTOR } from "../../../../../features/projects/constants";
import { CREATE_ISSUE_KEY, EDITABLE_SELECTOR } from "../constants";

const isTyping = (target: EventTarget | null) => target instanceof Element && target.closest(EDITABLE_SELECTOR) !== null;

const inTab = (root: HTMLElement | null, target: EventTarget | null) =>
  root !== null && (target === document.body || (target instanceof Node && root.contains(target)));

export function useCreateShortcut(rootRef: RefObject<HTMLElement | null>, enabled: boolean, onTrigger: () => void): void {
  const latest = useRef(onTrigger);
  latest.current = onTrigger;
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== CREATE_ISSUE_KEY || isTyping(event.target)) return;
      if (document.querySelector(MODAL_SELECTOR) !== null || !inTab(rootRef.current, event.target)) return;
      event.preventDefault();
      latest.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, rootRef]);
}
