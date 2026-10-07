import { useCallback, type KeyboardEvent, type MouseEvent } from "react";

const ACTIVATION_KEYS = new Set(["Enter", " "]);
const NESTED_CONTROL = "button, a, input, textarea, select, [role='button'], [role='menuitem']";

function fromNestedControl(target: EventTarget, row: Element): boolean {
  if (!(target instanceof Element)) return false;
  const control = target.closest(NESTED_CONTROL);
  return control !== null && control !== row && row.contains(control);
}

export interface RowActivationProps {
  tabIndex?: number;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
}

export function useRowActivation(onActivate: (() => void) | undefined): RowActivationProps {
  const onClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (!onActivate || fromNestedControl(event.target, event.currentTarget)) return;
      onActivate();
    },
    [onActivate],
  );
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (!onActivate || event.target !== event.currentTarget || !ACTIVATION_KEYS.has(event.key)) return;
      event.preventDefault();
      onActivate();
    },
    [onActivate],
  );
  if (!onActivate) return {};
  return { tabIndex: 0, onClick, onKeyDown };
}
