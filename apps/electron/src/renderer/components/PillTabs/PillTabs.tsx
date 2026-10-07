import { motion } from "motion/react";
import { useId } from "react";
import { cx } from "../../lib/cx";
import { transition } from "../../theme/motion";
import type { PillTab } from "./types";
import { usePillTabs } from "./use-pill-tabs";
import styles from "./PillTabs.module.css";

export interface PillTabsProps {
  tabs: readonly PillTab[];
  selected: string;
  onChange: (id: string) => void;
  label: string;
  className?: string;
}

export function PillTabs({ tabs, selected, onChange, label, className }: PillTabsProps) {
  const indicatorId = useId();
  const { select, register, onKeyDown } = usePillTabs(tabs, selected, onChange);
  return (
    <div role="tablist" aria-label={label} className={cx(styles.tabs, className)} onKeyDown={onKeyDown}>
      {tabs.map((tab) => {
        const checked = tab.id === selected;
        return (
          <button
            key={tab.id}
            ref={register(tab.id)}
            type="button"
            role="tab"
            aria-selected={checked}
            tabIndex={checked ? 0 : -1}
            data-checked={checked || undefined}
            className={styles.tab}
            onClick={() => select(tab.id)}
          >
            {checked ? (
              <motion.span layoutId={indicatorId} className={styles.indicator} transition={transition.normal} />
            ) : null}
            <span className={styles.content}>
              <span className={styles.label}>{tab.label}</span>
              {tab.count ? <span className={styles.count}>{tab.count}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
