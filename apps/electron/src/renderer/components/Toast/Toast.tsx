import type { HTMLAttributes } from "react";
import { cx } from "../../lib/cx";
import { IconButton } from "../IconButton";
import { TOAST_LABELS } from "./labels";
import type { ToastAction } from "./store";
import styles from "./Toast.module.css";

export interface ToastProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  message: string;
  action?: ToastAction;
  onDismiss?: () => void;
}

export function Toast({ message, action, onDismiss, className, ...rest }: ToastProps) {
  return (
    <div {...rest} role="status" className={cx(styles.toast, className)}>
      <span className={styles.message}>{message}</span>
      {action ? (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            action.run();
            onDismiss?.();
          }}
        >
          {action.label}
        </button>
      ) : null}
      {onDismiss ? (
        <IconButton icon="close" label={TOAST_LABELS.dismiss} variant="round" tooltip={null} onClick={onDismiss} />
      ) : null}
    </div>
  );
}
