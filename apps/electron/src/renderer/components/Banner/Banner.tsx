import { AnimatePresence, motion } from "motion/react";
import { cx } from "../../lib/cx";
import type { Tone } from "../../theme/colors";
import { reveal } from "../../theme/motion";
import styles from "./Banner.module.css";

export interface BannerProps {
  title: string;
  tone?: Tone;
  buttonLabel?: string | null;
  onButton?: () => void;
  revealed?: boolean;
  className?: string;
}

export function Banner({ title, tone = "neutral", buttonLabel, onButton, revealed = true, className }: BannerProps) {
  const role = tone === "danger" || tone === "warning" ? "alert" : "status";
  return (
    <AnimatePresence initial={false}>
      {revealed ? (
        <motion.div key="banner" className={styles.reveal} variants={reveal} initial="initial" animate="animate" exit="exit">
          <div className={cx(styles.banner, tone !== "neutral" && styles[tone], className)} role={role} data-tone={tone}>
            <span className={styles.title}>{title}</span>
            <div className={styles.end}>
              {buttonLabel && onButton ? (
                <button type="button" className={styles.button} onClick={onButton}>
                  {buttonLabel}
                </button>
              ) : null}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
