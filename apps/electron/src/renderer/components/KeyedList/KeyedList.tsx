import { AnimatePresence, motion } from "motion/react";
import { useMemo, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import { reveal, transition } from "../../theme/motion";
import { useExitInert } from "../Presence/use-exit-inert";
import { RowListContext } from "../Row";
import styles from "./KeyedList.module.css";

export interface KeyedListProps<T> {
  items: readonly T[];
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  divided?: boolean;
  label?: string;
  className?: string;
}

export function KeyedList<T>({ items, getKey, renderItem, divided = false, label, className }: KeyedListProps<T>) {
  const context = useMemo(() => ({ divided }), [divided]);
  if (items.length === 0) return null;
  return (
    <RowListContext.Provider value={context}>
      <div role="list" aria-label={label} className={cx(styles.list, divided && styles.divided, className)}>
        <AnimatePresence initial={false}>
          {items.map((item, index) => (
            <KeyedListItem key={getKey(item, index)}>{renderItem(item, index)}</KeyedListItem>
          ))}
        </AnimatePresence>
      </div>
    </RowListContext.Provider>
  );
}

function KeyedListItem({ children }: { children: ReactNode }) {
  const ref = useExitInert();
  return (
    <motion.div
      ref={ref}
      role="listitem"
      className={styles.item}
      variants={reveal}
      initial="initial"
      animate="animate"
      exit="exit"
      layout="position"
      transition={transition.fast}
    >
      {children}
    </motion.div>
  );
}
