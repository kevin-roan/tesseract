import { AnimatePresence } from "motion/react";
import type { ReactNode } from "react";
import { Children } from "react";
import { cx } from "../../lib/cx";
import styles from "./Attachment.module.css";

export interface AttachmentTrayProps {
  children?: ReactNode;
  className?: string;
}

export function AttachmentTray({ children, className }: AttachmentTrayProps) {
  if (Children.count(children) === 0) return null;
  return (
    <div className={cx(styles.tray, className)}>
      <div className={styles.row}>
        <AnimatePresence initial={false}>{children}</AnimatePresence>
      </div>
    </div>
  );
}
