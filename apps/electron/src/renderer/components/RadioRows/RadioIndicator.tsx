import { cx } from "../../lib/cx";
import styles from "./RadioRows.module.css";

export function RadioIndicator({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span className={cx(styles.radio, className)} data-checked={checked || undefined} aria-hidden>
      <span className={styles.dot} />
    </span>
  );
}
