import { cx } from "../../lib/cx";
import { cssVar, TONE_COLORS, type SemanticColor, type Tone } from "../../theme/colors";
import { PROGRESS_MIN_FILL_PX, PROGRESS_TRACK_ALPHA } from "./constants";
import styles from "./ProgressBar.module.css";

export interface ProgressBarProps {
  progress: number | null;
  tone?: Tone;
  color?: SemanticColor;
  className?: string;
  label?: string;
}

export function ProgressBar({ progress, tone = "info", color: colorOverride, className, label }: ProgressBarProps) {
  const color = cssVar(colorOverride ?? TONE_COLORS[tone].fg);
  const value = progress === null ? null : Math.min(1, Math.max(0, progress));
  return (
    <div
      className={cx(styles.track, className)}
      style={{ color, background: `color-mix(in srgb, ${color} ${PROGRESS_TRACK_ALPHA}%, transparent)` }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : Math.round(value * 100)}
    >
      {value === null ? (
        <div className={styles.indeterminate} />
      ) : value > 0 ? (
        <div className={styles.fill} style={{ width: `max(${value * 100}%, ${PROGRESS_MIN_FILL_PX}px)` }} />
      ) : null}
    </div>
  );
}
