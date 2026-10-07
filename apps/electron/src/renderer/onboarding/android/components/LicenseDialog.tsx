import { AnimatePresence, motion } from "motion/react";
import { ActionButton } from "../../../components/ActionButton";
import { Checkbox } from "../../../components/Checkbox";
import { DialogShell } from "../../../components/DialogShell";
import { Icon } from "../../../components/Icon";
import { Text } from "../../../components/Text";
import { cx } from "../../../lib/cx";
import { fade } from "../../../theme/motion";
import { LICENSE_DIALOG_WIDTH } from "../constants";
import { useLicenseReview } from "../hooks/use-license-review";
import { ANDROID_LABELS } from "../labels";
import { licenseName } from "../model";
import styles from "./LicenseDialog.module.css";

export interface LicenseDialogProps {
  open: boolean;
  pending: readonly string[];
  texts: Readonly<Record<string, string>>;
  busy: boolean;
  onAccept(ids: readonly string[]): void;
  onCancel(): void;
}

const LABELS = ANDROID_LABELS.licenses;

export function LicenseDialog({ open, pending, texts, busy, onAccept, onCancel }: LicenseDialogProps) {
  const review = useLicenseReview(pending);
  const current = review.current;
  return (
    <DialogShell
      open={open}
      title={LABELS.title}
      width={LICENSE_DIALOG_WIDTH}
      onClose={onCancel}
      bodyClassName={styles.body}
      footerEnd={
        <>
          <ActionButton label={LABELS.cancel} size="dialog" data-dialog-cancel="" onClick={onCancel} />
          <ActionButton
            label={LABELS.acceptAndInstall}
            variant="primary"
            size="dialog"
            data-dialog-default=""
            busy={busy}
            disabled={!review.allAccepted || busy}
            onClick={() => onAccept(pending)}
          />
        </>
      }
    >
      <Text variant="body" color="text-secondary" wrap lines={null}>
        {LABELS.intro}
      </Text>
      <div className={styles.columns}>
        <ul className={styles.list} aria-label={LABELS.title}>
          {pending.map((id) => {
            const accepted = review.accepted.has(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  className={cx(styles.item, id === current && styles.current)}
                  aria-current={id === current || undefined}
                  onClick={() => review.show(id)}
                >
                  <span className={styles.glyph} data-accepted={accepted || undefined}>
                    <Icon name={accepted ? "success" : "status-todo"} />
                  </span>
                  <span className={styles.itemText}>
                    <span className={styles.itemTitle}>{licenseName(id)}</span>
                    <span className={styles.itemState}>{accepted ? LABELS.accepted : LABELS.pending}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className={styles.viewer}>
          <AnimatePresence mode="wait" initial={false}>
            {current ? (
              <motion.div key={current} className={styles.viewerInner} variants={fade} initial="initial" animate="animate" exit="exit">
                <Text variant="bodyStrong">{licenseName(current)}</Text>
                <pre className={styles.text} tabIndex={0}>
                  {texts[current] ?? LABELS.missingText}
                </pre>
                <Checkbox
                  label={LABELS.accept}
                  checked={review.accepted.has(current)}
                  disabled={busy}
                  onChange={(on) => review.setAccepted(current, on)}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </DialogShell>
  );
}
