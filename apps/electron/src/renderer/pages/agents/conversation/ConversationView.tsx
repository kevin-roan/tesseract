import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { EmptyState } from "../../../components/EmptyState";
import { Crossfade } from "../../../components/Presence";
import { CONVERSATION_LABELS } from "../../../features/agents/labels";
import { cx } from "../../../lib/cx";
import { RunTimeline } from "../timeline";
import { ConversationHeader } from "./ConversationHeader";
import { ConversationNotices } from "./ConversationNotices";
import { FollowUpComposer } from "./FollowUpComposer";
import { RunningWork } from "./RunningWork";
import type { ConversationViewProps } from "./types";
import { useConversation } from "./use-conversation";
import styles from "./Conversation.module.css";

export function ConversationView(props: ConversationViewProps) {
  const { runs, compact = false, renderSync, onSelectRun, className } = props;
  const model = useConversation(props);
  const { run, header, composer, stopDialog } = model;
  const sync =
    run?.projectId && renderSync
      ? renderSync({ projectId: run.projectId, compact, running: model.running, report: model.syncReport })
      : null;

  return (
    <section className={cx(styles.conversation, className)} data-compact={compact || undefined} aria-label={header.title || undefined}>
      <ConversationHeader
        run={run}
        title={header.title}
        project={header.project}
        actions={header.actions}
        sections={header.sections}
        stopping={header.stopping}
        sync={sync}
        onStop={header.requestStop}
        onOpenTerminal={header.openTerminal}
        onManage={header.manage}
      />
      <ConversationNotices notices={model.notices} />
      <Crossfade id={model.body} className={styles.body} layerClassName={styles.bodyLayer}>
        {model.body === "timeline" && run ? (
          <RunTimeline run={run} events={model.events} names={model.names} runs={runs} now={model.now} onSelectRun={onSelectRun} />
        ) : model.body === "error" ? (
          <EmptyState
            title={CONVERSATION_LABELS.loadFailedTitle}
            message={model.error}
            icon="warning"
            actionLabel={CONVERSATION_LABELS.retry}
            onAction={model.reload}
          />
        ) : (
          <EmptyState title={CONVERSATION_LABELS.loading} loading />
        )}
      </Crossfade>
      <RunningWork projectId={run?.projectId} />
      <FollowUpComposer
        value={composer.value}
        onChange={composer.onChange}
        onSubmit={composer.onSubmit}
        busy={composer.busy}
        locked={composer.locked}
        attachments={composer.attachments}
      />
      <ConfirmDialog
        open={stopDialog.open}
        heading={CONVERSATION_LABELS.cancelConfirmTitle}
        body={CONVERSATION_LABELS.cancelConfirmBody}
        confirmLabel={CONVERSATION_LABELS.cancelConfirmYes}
        cancelLabel={CONVERSATION_LABELS.cancelConfirmNo}
        onConfirm={stopDialog.confirm}
        onClose={stopDialog.close}
      />
    </section>
  );
}
