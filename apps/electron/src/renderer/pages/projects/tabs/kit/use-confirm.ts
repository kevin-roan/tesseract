import { useCallback, useMemo, useState } from "react";
import type { ConfirmOption } from "../../../../components/ConfirmDialog";

export interface ConfirmRequest {
  heading: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  options?: readonly ConfirmOption[];
  chooseLabel?: string;
  onConfirm(choice: string | null): void;
}

export interface ConfirmState {
  request: ConfirmRequest | null;
  open: boolean;
  ask(request: ConfirmRequest): void;
  close(): void;
  clear(): void;
}

export function useConfirm(): ConfirmState {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [open, setOpen] = useState(false);
  const ask = useCallback((next: ConfirmRequest) => {
    setRequest(next);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  const clear = useCallback(() => setRequest((current) => (open ? current : null)), [open]);
  return useMemo(() => ({ request, open, ask, close, clear }), [request, open, ask, close, clear]);
}
