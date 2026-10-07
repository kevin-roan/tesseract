import type { ButtonHTMLAttributes, Ref } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../../lib/cx";
import type { IconName } from "../../theme/icons";
import { Icon } from "../Icon";
import { Spinner } from "../Spinner";
import { Tooltip } from "../Tooltip";
import styles from "./ActionButton.module.css";

export type ActionButtonVariant = "primary" | "secondary" | "flat" | "destructive" | "attention" | "link";
export type ActionButtonSize = "sm" | "md" | "dialog";

export interface ActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  icon?: IconName | LucideIcon;
  busy?: boolean;
  tooltip?: string;
  shortcut?: string;
  block?: boolean;
  muted?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function ActionButton({
  label,
  variant = "secondary",
  size = "md",
  icon,
  busy = false,
  tooltip,
  shortcut,
  block = false,
  muted = false,
  ref,
  className,
  type = "button",
  ...rest
}: ActionButtonProps) {
  const lead = busy ? (
    <Spinner size={14} />
  ) : typeof icon === "string" ? (
    <Icon name={icon} />
  ) : icon ? (
    <Icon icon={icon} />
  ) : null;
  const button = (
    <button
      {...rest}
      ref={ref}
      type={type}
      aria-busy={busy || undefined}
      data-variant={variant}
      className={cx(styles.button, styles[variant], size !== "md" && styles[size], block && styles.block, muted && styles.muted, className)}
    >
      {lead ? (
        <span key={busy ? "busy" : "icon"} className={cx(styles.lead, busy && styles.leadEnter)}>
          {lead}
        </span>
      ) : null}
      <span className={styles.label}>{label}</span>
    </button>
  );
  if (!tooltip && !shortcut) return button;
  return (
    <Tooltip label={tooltip ?? label} shortcut={shortcut}>
      {button}
    </Tooltip>
  );
}
