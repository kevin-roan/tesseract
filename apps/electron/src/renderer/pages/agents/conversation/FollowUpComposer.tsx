import { Composer } from "../../../components/Composer";
import type { AgentAttachments } from "../../../features/agents/hooks/use-attachments";
import { CONVERSATION_LABELS } from "../../../features/agents/labels";
import { AttachmentDrafts } from "../shared/AttachmentDrafts";
import { FOLLOW_UP_MAX_HEIGHT } from "./constants";
import styles from "./Conversation.module.css";

export interface FollowUpComposerProps {
  value: string;
  onChange(value: string): void;
  onSubmit(text: string): void;
  busy: boolean;
  locked: string | null;
  attachments: AgentAttachments;
}

export function FollowUpComposer({ value, onChange, onSubmit, busy, locked, attachments }: FollowUpComposerProps) {
  return (
    <div className={styles.footer}>
      <Composer
        className={styles.composer}
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        placeholder={CONVERSATION_LABELS.followUpPlaceholder}
        sendLabel={CONVERSATION_LABELS.followUpSend}
        maxHeight={FOLLOW_UP_MAX_HEIGHT}
        busy={busy}
        locked={locked}
        hasAttachments={attachments.hasItems}
        attachmentsBlocked={attachments.blocked}
        tray={<AttachmentDrafts attachments={attachments} />}
        onAttach={attachments.attach}
        onDropFiles={attachments.dropFiles}
      />
    </div>
  );
}
