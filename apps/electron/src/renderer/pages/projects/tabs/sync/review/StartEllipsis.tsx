import { cx } from "../../../../../lib/cx";
import styles from "./SyncReview.module.css";

export interface StartEllipsisProps {
  text: string;
  className?: string;
  title?: string;
}

export function StartEllipsis({ text, className, title }: StartEllipsisProps) {
  return (
    <span className={cx(styles.start, className)} title={title}>
      <span className={styles.startInner}>{text}</span>
    </span>
  );
}
