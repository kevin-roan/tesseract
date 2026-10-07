import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import styles from "./Sidebar.module.css";

export interface SidebarProps {
  header?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  label?: string;
  className?: string;
}

export function Sidebar({ header, footer, children, label, className }: SidebarProps) {
  return (
    <aside className={cx(styles.sidebar, className)} aria-label={label}>
      {header}
      <div className={styles.body}>{children}</div>
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </aside>
  );
}
