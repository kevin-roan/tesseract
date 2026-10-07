import { cx } from "../../lib/cx";
import {
  SKELETON_ICON_SIZE,
  SKELETON_META_WIDTH,
  SKELETON_ROW_COUNT,
  SKELETON_TEXT_HEIGHT,
  SKELETON_TITLE_WIDTHS,
} from "./constants";
import { SKELETON_LABELS } from "./labels";
import { Skeleton } from "./Skeleton";
import styles from "./Skeleton.module.css";

export interface SkeletonRowsProps {
  rows?: number;
  icon?: boolean;
  meta?: boolean;
  label?: string;
  className?: string;
}

export function SkeletonRows({ rows = SKELETON_ROW_COUNT, icon = true, meta = true, label = SKELETON_LABELS.loading, className }: SkeletonRowsProps) {
  return (
    <div role="status" aria-busy aria-label={label} className={cx(styles.rows, className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={styles.row}>
          {icon ? <Skeleton shape="circle" width={SKELETON_ICON_SIZE} /> : null}
          <Skeleton width={SKELETON_TITLE_WIDTHS[index % SKELETON_TITLE_WIDTHS.length]} height={SKELETON_TEXT_HEIGHT} />
          <span className={styles.fill} />
          {meta ? <Skeleton width={SKELETON_META_WIDTH} height={SKELETON_TEXT_HEIGHT} /> : null}
        </div>
      ))}
    </div>
  );
}
