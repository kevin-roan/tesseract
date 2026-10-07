import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import type { AriaRole, CSSProperties, ReactNode } from "react";
import { cx } from "../../lib/cx";
import { LIST_ITEM_VARIANTS, LIST_LAYOUT_TRANSITION } from "./variants";
import styles from "./AnimatedList.module.css";

export interface AnimatedListProps {
  children: ReactNode;
  animateOnMount?: boolean;
  gap?: number;
  role?: AriaRole;
  label?: string;
  className?: string;
  layoutId?: string;
}

export function AnimatedList({ children, animateOnMount = false, gap = 0, role, label, className, layoutId }: AnimatedListProps) {
  return (
    <LayoutGroup id={layoutId}>
      <div className={cx(styles.list, className)} style={{ gap }} role={role} aria-label={label}>
        <AnimatePresence initial={animateOnMount}>
          {children}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}

export interface AnimatedListItemProps {
  children: ReactNode;
  index?: number;
  layout?: boolean;
  role?: AriaRole;
  className?: string;
  style?: CSSProperties;
}

export function AnimatedListItem({ children, index, layout = true, role, className, style }: AnimatedListItemProps) {
  return (
    <motion.div
      className={cx(styles.item, className)}
      style={style}
      role={role}
      layout={layout ? "position" : false}
      transition={{ layout: LIST_LAYOUT_TRANSITION }}
      custom={index}
      variants={LIST_ITEM_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}
