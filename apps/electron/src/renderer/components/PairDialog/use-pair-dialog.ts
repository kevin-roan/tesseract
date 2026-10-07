import { useEffect, useId, useRef, useState } from "react";
import { copyText } from "../CopyButton/copy-text";
import { showToast, TOAST_TIMEOUT_MS } from "../Toast";
import type { PairTarget } from "./constants";
import { PAIR_LABELS } from "./labels";
import { hostPanel, sandboxPanel, type HostPairingState, type PairPanelModel, type SandboxPairing } from "./model";

export interface PairDialogOptions {
  open: boolean;
  initialTarget: PairTarget;
  sandbox: SandboxPairing;
  host: HostPairingState | null;
  onOpenPreferences(): void;
  onStartHost(): void;
  onRefreshHost(): void;
  onSavePin?: (pin: string) => Promise<void>;
  onCopy?: (text: string) => Promise<boolean | void> | boolean | void;
}

export interface PairDialogState {
  target: PairTarget;
  setTarget(target: PairTarget): void;
  panels: Record<PairTarget, PairPanelModel>;
  active: PairPanelModel;
  toastScope: string;
  copy(text: string): Promise<boolean>;
  copyActive(): void;
  pinOpen: boolean;
  closePin(): void;
}

async function writeLink(text: string, onCopy: PairDialogOptions["onCopy"]): Promise<boolean> {
  if (!onCopy) return copyText(text);
  try {
    return (await onCopy(text)) !== false;
  } catch {
    return false;
  }
}

export function usePairDialog(options: PairDialogOptions): PairDialogState {
  const { open, initialTarget, sandbox, host, onOpenPreferences, onStartHost, onRefreshHost, onSavePin, onCopy } = options;
  const [target, setTarget] = useState<PairTarget>(initialTarget);
  const [pinOpen, setPinOpen] = useState(false);
  const toastScope = `pair-dialog-${useId()}`;
  const latest = useRef({ initialTarget, onRefreshHost });

  useEffect(() => {
    latest.current = { initialTarget, onRefreshHost };
  });

  useEffect(() => {
    if (!open) return;
    setTarget(latest.current.initialTarget);
    setPinOpen(false);
    latest.current.onRefreshHost();
  }, [open]);

  const panels: Record<PairTarget, PairPanelModel> = {
    sandbox: sandboxPanel(sandbox, { openPreferences: onOpenPreferences }),
    host: hostPanel(host, {
      openPreferences: onOpenPreferences,
      startHost: onStartHost,
      retryHost: onRefreshHost,
      setPin: onSavePin ? () => setPinOpen(true) : undefined,
    }),
  };
  const active = panels[target];

  const copy = async (text: string): Promise<boolean> => {
    const ok = await writeLink(text, onCopy);
    if (ok) showToast(PAIR_LABELS.copied, { scope: toastScope });
    else showToast(PAIR_LABELS.copyFailed, { scope: toastScope, timeoutMs: TOAST_TIMEOUT_MS.failure });
    return ok;
  };

  return {
    target,
    setTarget,
    panels,
    active,
    toastScope,
    copy,
    copyActive: () => {
      if (active.link) void copy(active.link);
    },
    pinOpen,
    closePin: () => setPinOpen(false),
  };
}
