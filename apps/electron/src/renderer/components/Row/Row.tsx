import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { useRowList } from "./row-context";
import { useRowActivation } from "./use-row-activation";
import styles from "./Row.module.css";

export interface RowProps {
  children: ReactNode;
  onActivate?: () => void;
  hoverActions?: ReactNode;
  selected?: boolean;
  label?: string;
  className?: string;
}

export function Row({ children, onActivate, hoverActions, selected = false, label, className }: RowProps) {
  const { divided } = useRowList();
  const activation = useRowActivation(onActivate);
  return (
    <div
      {...activation}
      className={cx(styles.row, divided && styles.divided, onActivate && styles.activatable, className)}
      data-selected={selected || undefined}
      aria-current={selected || undefined}
      aria-label={label}
    >
      {children}
      {hoverActions ? <div className={styles.hoverActions}>{hoverActions}</div> : null}
    </div>
  );
}
