import { cx } from "../../lib/cx";
import { isTruncated, Tooltip } from "../Tooltip";
import styles from "./RecordRow.module.css";

export interface OverflowTextProps {
  text: string;
  className?: string;
}

export function OverflowText({ text, className }: OverflowTextProps) {
  return (
    <Tooltip label={text} shouldShow={isTruncated}>
      <span className={cx(styles.ellipsis, className)}>{text}</span>
    </Tooltip>
  );
}
