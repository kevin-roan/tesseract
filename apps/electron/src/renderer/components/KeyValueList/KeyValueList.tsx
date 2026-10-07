import { cx } from "../../lib/cx";
import { cssVar, type SemanticColor } from "../../theme/colors";
import { isTruncated, Tooltip } from "../Tooltip";
import styles from "./KeyValueList.module.css";

export interface KeyValueRowProps {
  label: string;
  value: string;
  monospace?: boolean;
  color?: SemanticColor;
  className?: string;
}

export function KeyValueRow({ label, value, monospace = false, color, className }: KeyValueRowProps) {
  return (
    <div className={cx(styles.row, className)}>
      <span className={styles.label}>{label}</span>
      <Tooltip label={value} shouldShow={isTruncated}>
        <span className={cx(styles.value, monospace && styles.mono)} style={color ? { color: cssVar(color) } : undefined}>
          {value}
        </span>
      </Tooltip>
    </div>
  );
}

export type KeyValueEntry = readonly [label: string, value: string];

export interface KeyValueListProps {
  rows: readonly KeyValueEntry[];
  monospace?: boolean;
  flat?: boolean;
  className?: string;
}

export function KeyValueList({ rows, monospace = false, flat = false, className }: KeyValueListProps) {
  return (
    <div className={cx(styles.list, flat && styles.flat, className)}>
      {rows.map(([label, value]) => (
        <KeyValueRow key={label} label={label} value={value} monospace={monospace} />
      ))}
    </div>
  );
}
