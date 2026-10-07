import { AnimatePresence, motion } from "motion/react";
import { cx } from "../../lib/cx";
import { transition } from "../../theme/motion";
import { COUNT_BADGE_MAX, COUNT_POP_SCALE } from "./constants";
import { formatCount } from "./format";
import styles from "./CountBadge.module.css";

export interface CountBadgeProps {
  count: number | null | undefined;
  max?: number;
  plain?: boolean;
  className?: string;
}

export function CountBadge({ count, max = COUNT_BADGE_MAX, plain = false, className }: CountBadgeProps) {
  const text = formatCount(count, max);
  if (!text) return null;
  return (
    <span className={cx(plain ? styles.plain : styles.pill, className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={text}
          className={styles.value}
          initial={{ opacity: 0, scale: COUNT_POP_SCALE }}
          animate={{ opacity: 1, scale: 1, transition: transition.fast }}
          exit={{ opacity: 0, transition: transition.exit }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
