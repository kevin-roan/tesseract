import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../../lib/cx";
import type { IconName } from "../../theme/icons";
import { Icon } from "../Icon";
import { Tooltip, type TooltipPlacement } from "../Tooltip";
import styles from "./IconButton.module.css";

export type IconButtonVariant = "flat" | "bordered" | "round" | "filled" | "elevated";
export type IconButtonSize = 22 | 24 | 28 | 32;

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: IconName | LucideIcon;
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  checked?: boolean;
  toggle?: boolean;
  iconSize?: number;
  destructive?: boolean;
  tooltip?: string | null;
  shortcut?: string;
  tooltipPlacement?: TooltipPlacement;
}

export function IconButton({
  icon,
  label,
  variant = "flat",
  size = 28,
  checked = false,
  toggle = false,
  iconSize,
  destructive = false,
  tooltip,
  shortcut,
  tooltipPlacement,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  const button = (
    <button
      {...rest}
      type={type}
      aria-label={label}
      aria-pressed={toggle ? checked : checked || undefined}
      data-checked={checked || undefined}
      className={cx(styles.button, styles[variant], styles[`size${size}`], destructive && styles.danger, className)}
    >
      {typeof icon === "string" ? <Icon name={icon} size={iconSize} /> : <Icon icon={icon} size={iconSize} />}
    </button>
  );
  if (tooltip === null) return button;
  return (
    <Tooltip label={tooltip ?? label} shortcut={shortcut} placement={tooltipPlacement}>
      {button}
    </Tooltip>
  );
}
