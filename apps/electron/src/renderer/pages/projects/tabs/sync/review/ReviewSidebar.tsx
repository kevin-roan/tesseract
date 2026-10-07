import type { SyncFileChange } from "@theone/protocol";
import type { KeyboardEvent } from "react";
import { Notice } from "../../../../../components/Notice";
import { SearchField } from "../../../../../components/SearchField";
import { Text } from "../../../../../components/Text";
import { cssVar, TONE_COLORS } from "../../../../../theme/colors";
import { formatBytes } from "../../../../../features/projects/format";
import { SYNC_REVIEW_LABELS } from "../labels";
import { plural } from "../model";
import { MiddleEllipsis } from "./MiddleEllipsis";
import type { KindCount } from "./model";
import { ReviewFileRow } from "./ReviewFileRow";
import styles from "./SyncReview.module.css";

export interface ReviewSidebarProps {
  hostPath: string;
  totalBytes: number;
  files: SyncFileChange[];
  visible: SyncFileChange[];
  conflicts: SyncFileChange[];
  counts: KindCount[];
  query: string;
  onQuery(value: string): void;
  selectedPath: string | null;
  onSelect(path: string): void;
  onListKeyDown(event: KeyboardEvent): void;
}

export function ReviewSidebar({
  hostPath,
  totalBytes,
  files,
  visible,
  conflicts,
  counts,
  query,
  onQuery,
  selectedPath,
  onSelect,
  onListKeyDown,
}: ReviewSidebarProps) {
  const conflictPaths = conflicts.map((file) => file.path);
  return (
    <div className={styles.sidebar}>
      <MiddleEllipsis text={SYNC_REVIEW_LABELS.destination(hostPath)} title={hostPath} className={styles.destination} />
      <Text variant="bodyStrong">{SYNC_REVIEW_LABELS.stats(plural(files.length), formatBytes(totalBytes))}</Text>
      <div className={styles.counts}>
        {counts.map((count) => (
          <span key={count.kind} className={styles.count}>
            <span className={styles.code} style={{ color: cssVar(TONE_COLORS[count.tone].fg) }}>
              {count.code}
            </span>
            <Text variant="caption" color="text-secondary">
              {count.label}
            </Text>
          </span>
        ))}
      </div>
      {conflicts.length ? <Notice tone="warning" message={SYNC_REVIEW_LABELS.conflicts(plural(conflicts.length))} /> : null}
      <SearchField value={query} onChange={onQuery} placeholder={SYNC_REVIEW_LABELS.filter} size="sm" className={styles.filter} />
      {visible.length === 0 ? (
        <Text variant="caption" color="text-tertiary" center className={styles.noMatch}>
          {SYNC_REVIEW_LABELS.noMatch}
        </Text>
      ) : null}
      <div role="listbox" tabIndex={0} aria-label={SYNC_REVIEW_LABELS.files} className={styles.files} onKeyDown={onListKeyDown}>
        {visible.map((file) => (
          <ReviewFileRow
            key={file.path}
            change={file}
            conflict={conflictPaths.includes(file.path)}
            selected={file.path === selectedPath}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
