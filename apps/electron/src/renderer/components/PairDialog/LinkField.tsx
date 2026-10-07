import { IconButton } from "../IconButton";
import { Tooltip } from "../Tooltip";
import { middleSplit } from "./middle-split";
import styles from "./PairDialog.module.css";

export interface LinkFieldProps {
  value: string;
  copyLabel: string;
  onCopy(value: string): void;
}

export function LinkField({ value, copyLabel, onCopy }: LinkFieldProps) {
  const [head, tail] = middleSplit(value);
  return (
    <div className={styles.linkField}>
      <Tooltip label={value}>
        <span className={styles.linkValue} data-testid="pair-link">
          <span className={styles.linkHead}>{head}</span>
          <span className={styles.linkTail}>
            <span className={styles.linkTailInner}>{tail}</span>
          </span>
        </span>
      </Tooltip>
      <IconButton icon="copy" label={copyLabel} size={24} onClick={() => onCopy(value)} />
    </div>
  );
}
