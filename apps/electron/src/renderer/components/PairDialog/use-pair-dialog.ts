import { useEffect, useId, useRef, useState } from "react";
import type { MasterHostState } from "../../../shared/contracts/masterHost";
import { copyText } from "../CopyButton/copy-text";
import { errorMessage } from "../FormDialog";
import { showToast, TOAST_TIMEOUT_MS } from "../Toast";
import { PAIR_TARGETS, type PairTarget } from "./constants";
import { PAIR_LABELS } from "./labels";
import {
  fill,
  hostPanel,
  masterPanel,
  pairTargets,
  sandboxPanel,
  visibleTarget,
  type HostPairingState,
  type PairPanelModel,
  type SandboxPairing,
} from "./model";

export interface PairDialogOptions {
  open: boolean;
  initialTarget: PairTarget;
  sandbox: SandboxPairing;
  host: HostPairingState | null;
  master?: MasterHostState | null;
  onOpenPreferences(): void;
  onStartHost(): void;
  onRefreshHost(): void;
  onLinkMaster?: (link: string) => Promise<void>;
  onUnlinkMaster?: () => Promise<void>;
  onRefreshMaster?: () => void;
  onSavePin?: (pin: string) => Promise<void>;
  onCopy?: (text: string) => Promise<boolean | void> | boolean | void;
}

export interface PairLinkDraft {
  value: string;
  error: string | null;
  busy: boolean;
  setValue(value: string): void;
  submit(): void;
}

export interface PairDialogState {
  target: PairTarget;
  setTarget(target: PairTarget): void;
  targets: { id: PairTarget; label: string }[];
  panels: Record<PairTarget, PairPanelModel>;
  active: PairPanelModel;
  toastScope: string;
  copy(text: string): Promise<boolean>;
  copyCommand(text: string): Promise<boolean>;
  copyActive(): void;
  linkDraft: PairLinkDraft;
  pinOpen: boolean;
  closePin(): void;
}

async function writeText(text: string, onCopy: PairDialogOptions["onCopy"]): Promise<boolean> {
  if (!onCopy) return copyText(text);
  try {
    return (await onCopy(text)) !== false;
  } catch {
    return false;
  }
}

export function usePairDialog(options: PairDialogOptions): PairDialogState {
  const {
    open,
    initialTarget,
    sandbox,
    host,
    master,
    onOpenPreferences,
    onStartHost,
    onRefreshHost,
    onLinkMaster,
    onUnlinkMaster,
    onRefreshMaster,
    onSavePin,
    onCopy,
  } = options;
  const [selected, setTarget] = useState<PairTarget>(initialTarget);
  const [pinOpen, setPinOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const toastScope = `pair-dialog-${useId()}`;
  const latest = useRef({ initialTarget, onRefreshHost, onRefreshMaster });

  useEffect(() => {
    latest.current = { initialTarget, onRefreshHost, onRefreshMaster };
  });

  useEffect(() => {
    if (!open) return;
    setTarget(latest.current.initialTarget);
    setPinOpen(false);
    setDraft("");
    setLinkError(null);
    latest.current.onRefreshHost();
    latest.current.onRefreshMaster?.();
  }, [open]);

  const visible = pairTargets(master);
  const target = visibleTarget(selected, visible);
  const targets = PAIR_TARGETS.filter((option) => visible.includes(option.id)).map(({ id, label }) => ({ id, label }));

  const toast = (message: string, failure = false) =>
    showToast(message, { scope: toastScope, ...(failure ? { timeoutMs: TOAST_TIMEOUT_MS.failure } : {}) });

  const unlinkMaster = () => {
    if (!onUnlinkMaster) return;
    onUnlinkMaster().catch((error: unknown) => toast(fill(PAIR_LABELS.unlinkFailed, { error: errorMessage(error) }), true));
  };

  const panels: Record<PairTarget, PairPanelModel> = {
    sandbox: sandboxPanel(sandbox, { openPreferences: onOpenPreferences }),
    host: hostPanel(host, {
      openPreferences: onOpenPreferences,
      startHost: onStartHost,
      retryHost: onRefreshHost,
      setPin: onSavePin ? () => setPinOpen(true) : undefined,
    }),
    master: masterPanel(master ?? null, { openPreferences: onOpenPreferences, unlinkMaster }),
  };
  const active = panels[target];

  const copyWith = async (text: string, done: string, failed: string): Promise<boolean> => {
    const ok = await writeText(text, onCopy);
    toast(ok ? done : failed, !ok);
    return ok;
  };
  const copy = (text: string) => copyWith(text, PAIR_LABELS.copied, PAIR_LABELS.copyFailed);
  const copyCommand = (text: string) => copyWith(text, PAIR_LABELS.commandCopied, PAIR_LABELS.commandCopyFailed);

  const submitLink = () => {
    const link = draft.trim();
    if (!link || !onLinkMaster || linking) return;
    setLinking(true);
    setLinkError(null);
    onLinkMaster(link)
      .then(() => setDraft(""))
      .catch((error: unknown) => setLinkError(errorMessage(error)))
      .finally(() => setLinking(false));
  };

  return {
    target,
    setTarget,
    targets,
    panels,
    active,
    toastScope,
    copy,
    copyCommand,
    copyActive: () => {
      if (active.link) void copy(active.link);
    },
    linkDraft: {
      value: draft,
      error: linkError,
      busy: linking,
      setValue: (value) => {
        setDraft(value);
        setLinkError(null);
      },
      submit: submitLink,
    },
    pinOpen,
    closePin: () => setPinOpen(false),
  };
}
