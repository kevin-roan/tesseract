import { useCallback, type KeyboardEvent, type MouseEvent } from "react";
import { ACTIVATE_KEYS, NESTED_INTERACTIVE_SELECTOR } from "./constants";

function fromNestedControl(event: { target: EventTarget; currentTarget: Element }): boolean {
  const target = event.target as Element | null;
  const control = target?.closest?.(NESTED_INTERACTIVE_SELECTOR);
  return Boolean(control && control !== event.currentTarget && event.currentTarget.contains(control));
}

export function useRowActivation(onActivate: (() => void) | undefined, disabled: boolean) {
  const onClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (disabled || !onActivate || event.defaultPrevented || fromNestedControl(event)) return;
      onActivate();
    },
    [disabled, onActivate],
  );
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (disabled || !onActivate || event.target !== event.currentTarget || !ACTIVATE_KEYS.has(event.key)) return;
      event.preventDefault();
      onActivate();
    },
    [disabled, onActivate],
  );
  return { onClick, onKeyDown };
}
