import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { ESCAPE_KEY, MODAL_SELECTOR, SEARCH_KEY } from "../constants";

export interface ProjectSearch {
  open: boolean;
  text: string;
  inputRef: RefObject<HTMLInputElement | null>;
  rootRef: RefObject<HTMLDivElement | null>;
  setText(value: string): void;
  search(query: string): void;
  toggle(): void;
  stop(): void;
  clear(): void;
  onFieldKeyDownCapture(event: KeyboardEvent): void;
}

function isShortcut(event: globalThis.KeyboardEvent): boolean {
  return event.key.toLowerCase() === SEARCH_KEY && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
}

function inPage(root: HTMLElement | null, target: EventTarget | null): boolean {
  if (root === null || document.querySelector(MODAL_SELECTOR) !== null) return false;
  return target === document.body || (target instanceof Node && root.contains(target));
}

export function useProjectSearch(onQuery: (query: string) => void): ProjectSearch {
  const [open, setOpen] = useState(false);
  const [text, setTextState] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const queryRef = useRef(onQuery);
  queryRef.current = onQuery;
  const openRef = useRef(open);
  openRef.current = open;

  const setOpenState = useCallback((next: boolean) => {
    openRef.current = next;
    setOpen(next);
    if (!next) {
      setTextState("");
      queryRef.current("");
    }
  }, []);

  const toggle = useCallback(() => setOpenState(!openRef.current), [setOpenState]);
  const stop = useCallback(() => setOpenState(false), [setOpenState]);
  const clear = useCallback(() => {
    setTextState("");
    queryRef.current("");
  }, []);
  const search = useCallback((query: string) => {
    if (openRef.current) queryRef.current(query);
  }, []);

  const onFieldKeyDownCapture = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== ESCAPE_KEY) return;
      event.preventDefault();
      event.stopPropagation();
      stop();
    },
    [stop],
  );

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || !isShortcut(event) || !inPage(rootRef.current, event.target)) return;
      event.preventDefault();
      openRef.current = true;
      setOpen(true);
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return { open, text, inputRef, rootRef, setText: setTextState, search, toggle, stop, clear, onFieldKeyDownCapture };
}
