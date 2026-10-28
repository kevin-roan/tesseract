import { Composer, type SlashCommand } from "../../../components/Composer";
import type { AgentAttachments } from "../../../features/agents/hooks/use-attachments";
import { CONVERSATION_LABELS } from "../../../features/agents/labels";
import type { ModelKey } from "../../../features/agents/model";
import { AttachmentDrafts } from "../shared/AttachmentDrafts";
import { ModelPicker } from "../shared/ModelPicker";
import { FOLLOW_UP_MAX_HEIGHT } from "./constants";
import styles from "./Conversation.module.css";

export interface FollowUpComposerProps {
  value: string;
  onChange(value: string): void;
  onSubmit(text: string): void;
  busy: boolean;
  locked: string | null;
  attachments: AgentAttachments;
  model: ModelKey;
  onModelChange(model: ModelKey): void;
  slashCommands?: readonly SlashCommand[];
}

export function FollowUpComposer({ value, onChange, onSubmit, busy, locked, attachments, model, onModelChange, slashCommands }: FollowUpComposerProps) {
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
        properties={<ModelPicker value={model} disabled={locked !== null} onChange={onModelChange} />}
        onAttach={attachments.attach}
        onDropFiles={attachments.dropFiles}
        slashCommands={slashCommands}
      />
    </div>
  );
}
