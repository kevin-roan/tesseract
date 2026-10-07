import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import styles from "./ListToolbar.module.css";

export interface ListToolbarProps {
  start?: ReactNode;
  end?: ReactNode;
  label?: string;
  className?: string;
}

export function ListToolbar({ start, end, label, className }: ListToolbarProps) {
  return (
    <div className={cx(styles.toolbar, className)} role={label ? "group" : undefined} aria-label={label}>
      <div className={styles.start}>{start}</div>
      {end ? <div className={styles.end}>{end}</div> : null}
    </div>
  );
}
