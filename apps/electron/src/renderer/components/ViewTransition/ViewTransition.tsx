import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { useExitInert } from "../Presence/use-exit-inert";
import type { ViewDirection } from "./direction";
import { VIEW_VARIANTS } from "./variants";
import styles from "./ViewTransition.module.css";

export interface ViewTransitionProps {
  viewKey: string;
  direction?: ViewDirection;
  children: ReactNode;
  className?: string;
  viewClassName?: string;
}

export function ViewTransition({ viewKey, direction = "none", children, className, viewClassName }: ViewTransitionProps) {
  return (
    <div className={cx(styles.stack, className)}>
      <AnimatePresence initial={false} custom={direction}>
        <ViewLayer key={viewKey} viewKey={viewKey} direction={direction} className={viewClassName}>
          {children}
        </ViewLayer>
      </AnimatePresence>
    </div>
  );
}

interface ViewLayerProps {
  viewKey: string;
  direction: ViewDirection;
  className?: string;
  children: ReactNode;
}

function ViewLayer({ viewKey, direction, className, children }: ViewLayerProps) {
  const ref = useExitInert();
  return (
    <motion.div
      ref={ref}
      className={cx(styles.view, className)}
      custom={direction}
      variants={VIEW_VARIANTS}
      initial="enter"
      animate="center"
      exit="exit"
      data-view={viewKey}
    >
      {children}
    </motion.div>
  );
}
