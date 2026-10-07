import { useCallback, useState } from "react";

export interface DisclosureOptions {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export interface Disclosure {
  open: boolean;
  toggle(): void;
  setOpen(open: boolean): void;
}

export function useDisclosure({ open, defaultOpen = true, onOpenChange }: DisclosureOptions): Disclosure {
  const [internal, setInternal] = useState(defaultOpen);
  const current = open ?? internal;
  const setOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) setInternal(next);
      onOpenChange?.(next);
    },
    [open, onOpenChange],
  );
  const toggle = useCallback(() => setOpen(!current), [setOpen, current]);
  return { open: current, toggle, setOpen };
}
