import { AnimatePresence, motion } from "motion/react";
import { cx } from "../../lib/cx";
import { popover } from "../../theme/motion";
import { COMPOSER_LABELS } from "./labels";
import type { SlashCommand } from "./model";
import styles from "./SlashHints.module.css";

export interface SlashHintsProps {
  id: string;
  open: boolean;
  matches: readonly SlashCommand[];
  activeIndex: number;
  onPick(index: number): void;
}

export function SlashHints({ id, open, matches, activeIndex, onPick }: SlashHintsProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          id={id}
          role="listbox"
          aria-label={COMPOSER_LABELS.slashHints}
          className={styles.hints}
          variants={popover}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {matches.map((match, index) => (
            <div
              key={match.command}
              id={`${id}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={cx(styles.row, index === activeIndex && styles.active)}
              onMouseDown={(event) => {
                event.preventDefault();
                onPick(index);
              }}
            >
              <span className={styles.command}>/{match.command.replace(/^\//, "")}</span>
              {match.description ? <span className={styles.description}>{match.description}</span> : null}
            </div>
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
