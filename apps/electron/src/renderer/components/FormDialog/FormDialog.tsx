import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { rise } from "../../theme/motion";
import { ActionButton } from "../ActionButton";
import { DialogShell, type DialogShellProps } from "../DialogShell";
import { Notice } from "../Notice";
import { Spinner } from "../Spinner";
import { Text } from "../Text";
import styles from "./FormDialog.module.css";

export interface FormDialogProps extends Omit<DialogShellProps, "onSubmit" | "footerEnd" | "variant" | "children"> {
  submitLabel?: string | null;
  cancelLabel?: string | null;
  onSubmit(): void;
  onCancel?: () => void;
  subtitle?: string | null;
  error?: string | null;
  busy?: boolean;
  submitDisabled?: boolean;
  footerEnd?: ReactNode;
  children?: ReactNode;
}

export function FormDialog({
  submitLabel,
  cancelLabel,
  onSubmit,
  onCancel,
  subtitle,
  error,
  busy = false,
  submitDisabled = false,
  footerStart,
  footerEnd,
  onClose,
  children,
  ...shell
}: FormDialogProps) {
  const submit = () => {
    if (busy || submitDisabled || !submitLabel) return;
    onSubmit();
  };

  return (
    <DialogShell
      {...shell}
      onClose={onClose}
      onSubmit={submit}
      footerStart={
        <>
          {cancelLabel ? (
            <ActionButton variant="flat" size="dialog" label={cancelLabel} onClick={onCancel ?? onClose} />
          ) : null}
          {footerStart}
        </>
      }
      footerEnd={
        <>
          {footerEnd}
          {busy ? (
            <span className={styles.spinner} data-testid="form-busy">
              <Spinner size={16} />
            </span>
          ) : null}
          {submitLabel ? (
            <ActionButton
              type="submit"
              variant="primary"
              size="dialog"
              label={submitLabel}
              disabled={busy || submitDisabled}
              data-dialog-default=""
            />
          ) : null}
        </>
      }
    >
      {subtitle ? (
        <Text variant="caption" color="text-secondary" wrap lines={null}>
          {subtitle}
        </Text>
      ) : null}
      <AnimatePresence initial={false}>
        {error ? (
          <motion.div key="error" variants={rise} initial="initial" animate="animate">
            <Notice tone="danger" message={error} />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <fieldset className={styles.fieldset} disabled={busy}>
        {children}
      </fieldset>
    </DialogShell>
  );
}
