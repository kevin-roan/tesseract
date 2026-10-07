import { AttachmentChip, AttachmentTray } from "../../../components/Composer";
import { formatBytes } from "../../../features/agents/format";
import type { AgentAttachments } from "../../../features/agents/hooks/use-attachments";

export interface AttachmentDraftsProps {
  attachments: AgentAttachments;
}

export function AttachmentDrafts({ attachments }: AttachmentDraftsProps) {
  return (
    <AttachmentTray>
      {attachments.drafts.map((draft) => (
        <AttachmentChip
          key={draft.key}
          name={draft.name}
          kind={draft.kind}
          meta={formatBytes(draft.size)}
          status={draft.status}
          error={draft.error}
          thumbnailUrl={draft.previewUrl}
          onRemove={() => attachments.remove(draft.key)}
          onRetry={() => attachments.retry(draft.key)}
        />
      ))}
    </AttachmentTray>
  );
}
