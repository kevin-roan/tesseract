import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { CONTENT_PANE_VARIANTS, SIDEBAR_PANE_VARIANTS } from "./variants";
import styles from "./SplitView.module.css";

export interface SplitViewProps {
  sidebar: ReactNode;
  children: ReactNode;
  sidebarWidth: number;
  collapsed?: boolean;
  showContent?: boolean;
  resizeHandle?: ReactNode;
  overlay?: ReactNode;
  className?: string;
  panelClassName?: string;
}

export function SplitView({
  sidebar,
  children,
  sidebarWidth,
  collapsed = false,
  showContent = true,
  resizeHandle,
  overlay,
  className,
  panelClassName,
}: SplitViewProps) {
  const sidebarVisible = !collapsed || !showContent;
  const contentVisible = !collapsed || showContent;
  return (
    <div className={cx(styles.window, collapsed && styles.collapsed, className)} data-collapsed={collapsed || undefined}>
      <motion.div
        className={styles.sidebarPane}
        style={collapsed ? undefined : { width: sidebarWidth }}
        variants={SIDEBAR_PANE_VARIANTS}
        initial={false}
        animate={sidebarVisible ? "shown" : "hidden"}
        aria-hidden={!sidebarVisible || undefined}
        inert={!sidebarVisible || undefined}
      >
        {sidebar}
        {!collapsed && resizeHandle ? <div className={styles.handle}>{resizeHandle}</div> : null}
      </motion.div>
      <motion.main
        className={cx(styles.panel, panelClassName)}
        variants={CONTENT_PANE_VARIANTS}
        initial={false}
        animate={contentVisible ? "shown" : "hidden"}
        aria-hidden={!contentVisible || undefined}
        inert={!contentVisible || undefined}
      >
        {children}
      </motion.main>
      {overlay}
    </div>
  );
}
