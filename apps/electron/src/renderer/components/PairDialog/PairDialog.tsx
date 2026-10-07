import { AnimatePresence, motion } from "motion/react";
import { ActionButton } from "../ActionButton";
import { DialogShell, type DialogPresentation } from "../DialogShell";
import { HostPinDialog } from "../HostPinDialog";
import { fade } from "../../theme/motion";
import { PAIR_TARGET_OPTIONS, PAIR_TARGETS, PAIR_TEXT, PAIR_WIDTH, type PairTarget } from "./constants";
import { PAIR_LABELS } from "./labels";
import type { HostPairingState, SandboxPairing } from "./model";
import { SegmentedControl } from "../SegmentedControl";
import { PairPanel } from "./PairPanel";
import { usePairDialog } from "./use-pair-dialog";
import styles from "./PairDialog.module.css";

export interface PairDialogProps {
  onClose(): void;
  sandbox: SandboxPairing;
  host: HostPairingState | null;
  onOpenPreferences(): void;
  onStartHost(): void;
  onRefreshHost(): void;
  onSavePin?: (pin: string) => Promise<void>;
  onCopy?: (text: string) => Promise<void> | void;
  open?: boolean;
  initialTarget?: PairTarget;
  presentation?: DialogPresentation;
  onExitComplete?: () => void;
}

export function PairDialog({
  onClose,
  open = true,
  initialTarget = "sandbox",
  presentation,
  onExitComplete,
  onSavePin,
  ...data
}: PairDialogProps) {
  const pair = usePairDialog({ ...data, open, initialTarget, onSavePin });
  const tab = PAIR_TARGETS.find((option) => option.id === pair.target) ?? PAIR_TARGETS[0];
  const text = PAIR_TEXT[pair.target];

  return (
    <>
      <DialogShell
        open={open}
        onClose={onClose}
        presentation={presentation}
        onExitComplete={onExitComplete}
        title={PAIR_LABELS.title}
        context={tab ? { label: tab.label, icon: tab.icon } : null}
        width={PAIR_WIDTH}
        toastScope={pair.toastScope}
        footerEnd={
          <>
            <ActionButton variant="flat" size="dialog" label={PAIR_LABELS.done} onClick={onClose} />
            <ActionButton
              variant="primary"
              size="dialog"
              label={PAIR_LABELS.copy}
              disabled={!pair.active.link}
              onClick={pair.copyActive}
              data-dialog-default=""
            />
          </>
        }
      >
        <div className={styles.segmentedRow}>
          <SegmentedControl tone="dialog" options={PAIR_TARGET_OPTIONS} value={pair.target} onChange={pair.setTarget} ariaLabel={PAIR_LABELS.title} />
        </div>
        <AnimatePresence initial={false}>
          <motion.div key={pair.target} variants={fade} initial="initial" animate="animate">
            <PairPanel
              model={pair.active}
              instructions={text.instructions}
              secret={text.secret}
              copyLabel={PAIR_LABELS.copy}
              onCopy={(link) => void pair.copy(link)}
            />
          </motion.div>
        </AnimatePresence>
      </DialogShell>
      {onSavePin ? (
        <HostPinDialog
          open={open && pair.pinOpen}
          onClose={pair.closePin}
          onSave={onSavePin}
          toastScope={pair.toastScope}
        />
      ) : null}
    </>
  );
}
