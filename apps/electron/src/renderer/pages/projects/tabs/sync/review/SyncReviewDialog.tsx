import { ActionButton } from "../../../../../components/ActionButton";
import { DEFAULT_SELECTOR, DialogShell } from "../../../../../components/DialogShell";
import { Text } from "../../../../../components/Text";
import { REVIEW_WIDTH } from "../constants";
import { useSyncReview } from "../hooks/use-sync-review";
import { SYNC_LABELS, SYNC_REVIEW_LABELS } from "../labels";
import type { SyncView } from "../model";
import { DiffPane } from "./DiffPane";
import { ReviewSidebar } from "./ReviewSidebar";
import styles from "./SyncReview.module.css";

export interface SyncReviewDialogProps {
  projectId: string;
  view: SyncView;
  open: boolean;
  onClose(): void;
  onConfirm(force: boolean, paths: string[]): void;
  onExitComplete?: () => void;
}

export function SyncReviewDialog({ projectId, view, open, onClose, onConfirm, onExitComplete }: SyncReviewDialogProps) {
  const review = useSyncReview(projectId, view, onConfirm, onClose);
  const selectedPath = review.selected?.path ?? null;
  return (
    <DialogShell
      open={open}
      title={SYNC_REVIEW_LABELS.title}
      context={{ label: projectId, icon: "sync" }}
      width={REVIEW_WIDTH}
      onClose={onClose}
      onSubmit={review.confirm}
      onExitComplete={onExitComplete}
      initialFocus={{ selector: DEFAULT_SELECTOR }}
      className={styles.sheet}
      bodyClassName={styles.body}
      footerStart={
        <Text variant="caption" color="text-tertiary">
          {SYNC_REVIEW_LABELS.snapshot}
        </Text>
      }
      footerEnd={
        <>
          <ActionButton data-dialog-cancel="" variant="flat" size="dialog" label={SYNC_LABELS.cancel} onClick={onClose} />
          <ActionButton
            type="submit"
            data-dialog-default=""
            variant={review.destructive ? "destructive" : "primary"}
            size="dialog"
            label={review.confirmLabel}
          />
        </>
      }
    >
      <ReviewSidebar
        hostPath={view.link?.hostPath ?? ""}
        totalBytes={view.changes?.totalBytes ?? 0}
        files={review.files}
        visible={review.visible}
        conflicts={review.conflicts}
        counts={review.counts}
        query={review.query}
        onQuery={review.setQuery}
        selectedPath={selectedPath}
        onSelect={review.select}
        onListKeyDown={review.onListKeyDown}
      />
      <div className={styles.divider} />
      <DiffPane change={review.selected} conflict={selectedPath !== null && view.conflicts.includes(selectedPath)} display={review.display} />
    </DialogShell>
  );
}
