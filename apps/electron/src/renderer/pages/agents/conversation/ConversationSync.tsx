import { ActionButton } from "../../../components/ActionButton";
import { cx } from "../../../lib/cx";
import { TabConfirm } from "../../projects/tabs/kit/TabConfirm";
import { SyncReviewDialog } from "../../projects/tabs/sync/review/SyncReviewDialog";
import type { ConversationSyncState } from "./use-conversation-sync";
import styles from "./Conversation.module.css";

export interface ConversationSyncProps {
  state: ConversationSyncState;
  compact: boolean;
}

export function ConversationSync({ state, compact }: ConversationSyncProps) {
  const { actions, projectId } = state;
  return (
    <>
      {state.buttons.map((button) => (
        <ActionButton
          key={button.id}
          label={button.label}
          icon={button.icon}
          variant={button.variant}
          disabled={button.disabled}
          tooltip={button.tooltip}
          aria-label={button.label}
          className={cx(styles.syncButton, compact && styles.syncCompact)}
          onClick={button.onClick}
        />
      ))}
      <TabConfirm state={actions.confirm} />
      {actions.review && projectId ? (
        <SyncReviewDialog
          projectId={projectId}
          view={actions.review}
          open={actions.reviewOpen}
          onClose={actions.closeReview}
          onConfirm={actions.confirmReview}
          onExitComplete={actions.clearReview}
        />
      ) : null}
    </>
  );
}
