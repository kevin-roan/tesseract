import { cx } from "../../../../../lib/cx";
import { splitMiddle } from "./model";
import styles from "./SyncReview.module.css";

export interface MiddleEllipsisProps {
  text: string;
  className?: string;
  title?: string;
}

export function MiddleEllipsis({ text, className, title }: MiddleEllipsisProps) {
  const { head, tail } = splitMiddle(text);
  return (
    <span className={cx(styles.middle, className)} title={title}>
      <span className={styles.middleHead}>{head}</span>
      {tail ? <span className={styles.middleTail}>{tail}</span> : null}
    </span>
  );
}
