import { AnimatePresence, motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { reveal } from "../../theme/motion";
import { Icon } from "../Icon";
import { EXPANDER_CHEVRON_SIZE } from "./constants";
import { PreferenceRow } from "./PreferenceRow";
import { useExpanded } from "./use-expanded";
import styles from "./PreferenceRows.module.css";

export interface ExpanderRowProps {
  title: string;
  subtitle?: string;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?(expanded: boolean): void;
  children: ReactNode;
}

export function ExpanderRow({ title, subtitle, expanded, defaultExpanded = false, onExpandedChange, children }: ExpanderRowProps) {
  const contentId = useId();
  const state = useExpanded(expanded, defaultExpanded, onExpandedChange);
  return (
    <div className={styles.expander} data-expanded={state.expanded || undefined}>
      <PreferenceRow
        title={title}
        subtitle={subtitle}
        onActivate={state.toggle}
        aria-expanded={state.expanded}
        aria-controls={contentId}
        suffix={<Icon name="expand" size={EXPANDER_CHEVRON_SIZE} className={styles.chevron} />}
      />
      <AnimatePresence initial={false}>
        {state.expanded ? (
          <motion.div key="content" id={contentId} className={styles.nestedList} variants={reveal} initial="initial" animate="animate" exit="exit">
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
