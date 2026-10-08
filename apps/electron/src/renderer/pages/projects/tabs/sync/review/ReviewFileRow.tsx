import type { SyncFileChange } from "@tesseract/protocol";
import { cssVar, TONE_COLORS } from "../../../../../theme/colors";
import { SYNC_LABELS } from "../labels";
import { syncChangeCode } from "../model";
import { MiddleEllipsis } from "./MiddleEllipsis";
import { splitPath } from "./model";
import { StartEllipsis } from "./StartEllipsis";
import styles from "./SyncReview.module.css";

export interface ReviewFileRowProps {
  change: SyncFileChange;
  conflict: boolean;
  selected: boolean;
  onSelect(path: string): void;
}

export function ReviewFileRow({ change, conflict, selected, onSelect }: ReviewFileRowProps) {
  const { code, tone } = syncChangeCode(change.kind);
  const { directory, name } = splitPath(change.path);
  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      title={change.path}
      className={styles.file}
      data-selected={selected || undefined}
      onClick={() => onSelect(change.path)}
    >
      <span className={styles.code} style={{ color: cssVar(TONE_COLORS[tone].fg) }}>
        {code}
      </span>
      <MiddleEllipsis text={name} className={styles.fileName} />
      <StartEllipsis text={directory} className={styles.fileDir} />
      {conflict ? <span className={styles.hostEdit}>{SYNC_LABELS.conflictBadge}</span> : null}
    </div>
  );
}
