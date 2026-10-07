import type { ButtonHTMLAttributes } from "react";
import { cx } from "../../lib/cx";
import type { IconName } from "../../theme/icons";
import { Icon } from "../Icon";
import { Tooltip } from "../Tooltip";
import type { ChipKind, ChipSize } from "./types";
import styles from "./Chip.module.css";

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "role"> {
  label: string;
  icon?: IconName;
  selected?: boolean;
  size?: ChipSize;
  kind?: ChipKind;
  tooltip?: string;
}

export function Chip({ label, icon, selected = false, size = "default", kind = "toggle", tooltip, className, type = "button", ...rest }: ChipProps) {
  const chip = (
    <button
      {...rest}
      type={type}
      role={kind === "radio" || kind === "switch" ? kind : undefined}
      aria-checked={kind === "radio" || kind === "switch" ? selected : undefined}
      aria-pressed={kind === "toggle" ? selected : undefined}
      data-selected={selected || undefined}
      className={cx(styles.chip, styles[size], className)}
    >
      {icon ? <Icon name={icon} /> : null}
      <span className={styles.label}>{label}</span>
    </button>
  );
  return tooltip ? <Tooltip label={tooltip}>{chip}</Tooltip> : chip;
}
