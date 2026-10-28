import type { Issue } from "@tesseract/protocol";
import { AnimatePresence, motion } from "motion/react";
import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "../../../../components/ConfirmDialog";
import { useDialogBehavior } from "../../../../components/DialogShell";
import { IconButton } from "../../../../components/IconButton";
import { Text } from "../../../../components/Text";
import { fade } from "../../../../theme/motion";
import { sheetSlide } from "./motion";
import { ClaudeRunPanel } from "./ClaudeRunPanel";
import type { IssueActions } from "./hooks/use-issue-actions";
import { useIssueSheet } from "./hooks/use-issue-sheet";
import { IssueActivity } from "./IssueActivity";
import { IssueDescription } from "./IssueDescription";
import { StatusIcon } from "./IssueGlyphs";
import { IssueTitle } from "./IssueTitle";
import { SHEET_LABELS as L } from "./labels";
import { LabelsEditor } from "./LabelsEditor";
import { AssigneePicker, PriorityPicker, StatusPicker } from "./IssuePickers";
import { issueIdentifier, toChoice } from "./model";
import styles from "./IssueSheet.module.css";

export interface IssueSheetProps {
  issue: Issue | null;
  labelSuggestions: readonly string[];
  actions: IssueActions;
  onClose(): void;
  onViewRun(runId: string): void;
}

export function IssueSheet({ issue, labelSuggestions, actions, onClose, onViewRun }: IssueSheetProps) {
  return createPortal(
    <AnimatePresence>
      {issue ? (
        <motion.div key="issue-sheet" className={styles.layer} variants={fade} initial="initial" animate="animate" exit="exit">
          <div className={styles.scrim} onClick={onClose} aria-hidden />
          <SheetBody issue={issue} labelSuggestions={labelSuggestions} actions={actions} onClose={onClose} onViewRun={onViewRun} />
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function SheetBody({ issue, labelSuggestions, actions, onClose, onViewRun }: IssueSheetProps & { issue: Issue }) {
  const sheetRef = useRef<HTMLElement>(null);
  const titleId = useId();
  useDialogBehavior({ active: true, sheetRef, onClose, initialFocus: "none" });
  const sheet = useIssueSheet(issue, actions, onClose);
  const identifier = issueIdentifier(issue);
  return (
    <motion.aside
      ref={sheetRef}
      className={styles.sheet}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      variants={sheetSlide}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <header className={styles.header}>
        <StatusIcon status={issue.status} />
        <Text variant="label" color="text-secondary" tabular>
          <span id={titleId}>{identifier}</span>
        </Text>
        <span className={styles.spacer} />
        <IconButton icon="delete" size={24} destructive label={L.delete} onClick={sheet.askDelete} />
        <IconButton icon="close" size={24} label={L.close} onClick={onClose} />
      </header>
      <div className={styles.body}>
        <IssueTitle value={issue.title} onSave={sheet.set.title} />
        <dl className={styles.properties} aria-label={L.properties}>
          <dt>{L.status}</dt>
          <dd>
            <StatusPicker value={issue.status} onChange={sheet.set.status} />
          </dd>
          <dt>{L.priority}</dt>
          <dd>
            <PriorityPicker value={issue.priority} onChange={sheet.set.priority} />
          </dd>
          <dt>{L.assignee}</dt>
          <dd>
            <AssigneePicker value={toChoice(issue.assignee)} onChange={sheet.set.assignee} />
          </dd>
          <dt>{L.labels}</dt>
          <dd>
            <LabelsEditor labels={issue.labels} suggestions={labelSuggestions} onChange={sheet.set.labels} />
          </dd>
        </dl>
        <ClaudeRunPanel issue={issue} onDispatch={sheet.dispatch} onViewRun={onViewRun} />
        <IssueDescription value={issue.description} onSave={sheet.set.description} />
        <IssueActivity
          issue={issue}
          comments={sheet.comments}
          draft={sheet.comment}
          sending={sheet.sending}
          onDraft={sheet.setComment}
          onSend={(body) => void sheet.send(body)}
        />
      </div>
      <ConfirmDialog
        open={sheet.confirmingDelete}
        heading={L.deleteHeading(identifier)}
        body={L.deleteBody}
        confirmLabel={L.deleteConfirm}
        cancelLabel={L.cancel}
        onConfirm={() => void sheet.confirmDelete()}
        onClose={sheet.cancelDelete}
      />
    </motion.aside>
  );
}
