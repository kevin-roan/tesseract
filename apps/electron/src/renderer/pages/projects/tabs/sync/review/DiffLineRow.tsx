import { memo } from "react";
import type { FileDiffLine } from "../../../../../../shared/contracts/syncback";
import { lineSign } from "./model";
import styles from "./SyncReview.module.css";

export interface DiffLineRowProps {
  line: FileDiffLine;
}

export const DiffLineRow = memo(function DiffLineRow({ line }: DiffLineRowProps) {
  return (
    <div className={styles.line} data-kind={line.kind}>
      <span className={styles.gutter}>{line.oldLine ?? ""}</span>
      <span className={styles.gutter}>{line.newLine ?? ""}</span>
      <span className={styles.sign}>{lineSign(line)}</span>
      <span className={styles.lineText}>{line.text}</span>
    </div>
  );
});
