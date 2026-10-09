import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Text } from "../Text";
import styles from "./Sidebar.module.css";

export interface SidebarItemRowProps {
  name: string;
  indicator: ReactNode;
  label?: string;
  title?: string;
  badges?: ReactNode;
  trailing?: ReactNode;
  actions?: ReactNode;
  tint?: number | null;
  selected?: boolean;
  onActivate?: () => void;
  className?: string;
}

export function SidebarItemRow({
  name,
  indicator,
  label,
  title,
  badges,
  trailing,
  actions,
  tint = null,
  selected = false,
  onActivate,
  className,
}: SidebarItemRowProps) {
  const tinted = tint !== null;
  return (
    <div
      className={cx(styles.sideRow, tinted && styles.tinted, selected && styles.sideRowSelected, className)}
      style={tinted ? { ["--side-tint" as string]: `var(--to-tint-${tint})` } : undefined}
    >
      <button
        type="button"
        className={styles.sideMain}
        title={title}
        aria-label={label ?? name}
        aria-current={selected ? "page" : undefined}
        onClick={onActivate}
      >
        <span className={styles.activity}>{indicator}</span>
        <Text variant="label" color="text" className={styles.projectName}>
          {name}
        </Text>
        {badges}
        <span className={styles.spacer} />
        {trailing}
      </button>
      {actions}
    </div>
  );
}
