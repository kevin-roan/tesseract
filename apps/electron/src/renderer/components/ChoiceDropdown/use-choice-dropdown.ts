import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { rectAnchor, type AnchorRect } from "../ActionMenu";
import { resolveChoice, type ChoiceOption } from "./model";

const OPEN_KEYS = new Set(["ArrowDown", "ArrowUp", "Enter", " "]);

export function useChoiceDropdown<T extends string>(
  options: readonly ChoiceOption<T>[],
  value: T | null | undefined,
  onChange?: (id: T) => void,
) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const selected = useMemo(() => resolveChoice(options, value), [options, value]);

  const open = useCallback(() => {
    const trigger = triggerRef.current;
    if (trigger) setAnchor(rectAnchor(trigger.getBoundingClientRect()));
  }, []);
  const close = useCallback(() => setAnchor(null), []);
  const toggle = useCallback(() => (anchor ? close() : open()), [anchor, close, open]);

  const pick = useCallback(
    (id: T) => {
      close();
      if (id !== selected) onChange?.(id);
    },
    [close, onChange, selected],
  );

  const onTriggerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (!OPEN_KEYS.has(event.key)) return;
      event.preventDefault();
      open();
    },
    [open],
  );

  return {
    triggerRef,
    anchor,
    isOpen: anchor !== null,
    selected,
    toggle,
    close,
    pick,
    onTriggerKeyDown,
    width: anchor?.width,
  };
}
