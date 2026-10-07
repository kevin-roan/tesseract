import type { Platform } from "../../../shared/runtime";
import { cx } from "../../lib/cx";
import { useKeyLabels } from "./use-key-labels";
import styles from "./Kbd.module.css";

export type KbdSize = "sm" | "md";
export type KbdVariant = "cap" | "plain";

export interface KbdProps {
  keys: string | readonly string[];
  size?: KbdSize;
  variant?: KbdVariant;
  platform?: Platform;
  className?: string;
}

export function Kbd({ keys, size = "md", variant = "cap", platform, className }: KbdProps) {
  const { labels, separator } = useKeyLabels(keys, platform);
  if (labels.length === 0) return null;
  if (variant === "plain") {
    return (
      <kbd className={cx(styles.keys, styles.plain, className)} aria-label={labels.join("+")}>
        {labels.join(separator)}
      </kbd>
    );
  }
  return (
    <kbd className={cx(styles.keys, styles[size], className)} aria-label={labels.join("+")}>
      {labels.map((label, index) => (
        <kbd key={`${label}-${index}`} className={styles.cap} aria-hidden>
          {label}
        </kbd>
      ))}
    </kbd>
  );
}
