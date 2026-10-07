import { useId, useState } from "react";
import { ActionButton } from "../ActionButton";
import { ChoiceDropdown } from "../ChoiceDropdown";
import { CANCEL_SELECTOR, DEFAULT_SELECTOR, DialogShell, type DialogPresentation } from "../DialogShell";
import { Text } from "../Text";
import { CONFIRM_WIDTH } from "./constants";
import styles from "./ConfirmDialog.module.css";

export interface ConfirmOption {
  id: string;
  label: string;
}

export interface ConfirmDialogProps {
  heading: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm(choice: string | null): void;
  onClose(): void;
  open?: boolean;
  destructive?: boolean;
  options?: readonly ConfirmOption[];
  initialChoice?: string;
  chooseLabel?: string;
  presentation?: DialogPresentation;
  onExitComplete?: () => void;
}

export function ConfirmDialog({
  heading,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
  open = true,
  destructive = true,
  options,
  initialChoice,
  chooseLabel,
  presentation,
  onExitComplete,
}: ConfirmDialogProps) {
  const messageId = useId();
  const choosing = options !== undefined;
  const [choice, setChoice] = useState<string | null>(initialChoice ?? options?.[0]?.id ?? null);
  const selected = choosing ? (options.some((option) => option.id === choice) ? choice : (options[0]?.id ?? null)) : null;
  const disabled = choosing && selected === null;

  const confirm = () => {
    if (disabled) return;
    onClose();
    onConfirm(selected);
  };

  return (
    <DialogShell
      title={heading}
      onClose={onClose}
      open={open}
      width={CONFIRM_WIDTH}
      variant="confirm"
      role="alertdialog"
      describedBy={body ? messageId : undefined}
      presentation={presentation}
      onExitComplete={onExitComplete}
      onSubmit={confirm}
      initialFocus={{ selector: destructive ? CANCEL_SELECTOR : DEFAULT_SELECTOR }}
      footerEnd={
        <>
          <ActionButton data-dialog-cancel="" variant="flat" size="dialog" label={cancelLabel} onClick={onClose} />
          <ActionButton
            type="submit"
            variant={destructive ? "destructive" : "primary"}
            size="dialog"
            label={confirmLabel}
            disabled={disabled}
            data-dialog-default=""
          />
        </>
      }
    >
      {body ? (
        <span id={messageId}>
          <Text variant="body" color="text-secondary" wrap lines={null}>
            {body}
          </Text>
        </span>
      ) : null}
      {choosing ? (
        <ChoiceDropdown
          className={styles.select}
          ariaLabel={chooseLabel ?? heading}
          options={options}
          value={selected}
          disabled={disabled}
          onChange={setChoice}
        />
      ) : null}
    </DialogShell>
  );
}
