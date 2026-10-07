import { cx } from "../../lib/cx";
import type { IconName } from "../../theme/icons";
import { ActionButton } from "../ActionButton";
import { PreferenceRow } from "./PreferenceRow";
import styles from "./PreferenceRows.module.css";

export type ButtonRowVariant = "secondary" | "primary" | "destructive";

export interface ButtonRowProps {
  title: string;
  subtitle?: string;
  label: string;
  onActivate?(): void;
  variant?: ButtonRowVariant;
  icon?: IconName;
  busy?: boolean;
  disabled?: boolean;
}

export function ButtonRow({ title, subtitle, label, onActivate, variant = "secondary", icon, busy, disabled }: ButtonRowProps) {
  return (
    <PreferenceRow
      title={title}
      subtitle={subtitle}
      suffix={
        <ActionButton
          size="dialog"
          label={label}
          icon={icon}
          busy={busy}
          disabled={disabled || busy}
          variant={variant === "primary" ? "primary" : "secondary"}
          className={cx(variant === "destructive" ? styles.destructive : null)}
          onClick={onActivate}
        />
      }
    />
  );
}
