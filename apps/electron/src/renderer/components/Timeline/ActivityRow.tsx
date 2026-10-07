import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import styles from "./Timeline.module.css";

export interface ActivityRowProps {
  glyph: ReactNode;
  children?: ReactNode;
  inset?: boolean;
  className?: string;
}

export function ActivityRow({ glyph, children, inset = false, className }: ActivityRowProps) {
  return (
    <div className={cx(styles.activity, inset && styles.inset, className)}>
      <span className={styles.glyph}>{glyph}</span>
      {children}
    </div>
  );
}
