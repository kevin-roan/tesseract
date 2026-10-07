import { useEffect, useRef } from "react";
import { Composer } from "../../../components/Composer";
import { Icon } from "../../../components/Icon";
import { IconButton } from "../../../components/IconButton";
import { Notice } from "../../../components/Notice";
import { Text } from "../../../components/Text";
import type { AgentAttachments } from "../../../features/agents/hooks/use-attachments";
import { AGENTS_LABELS, NEW_LABELS } from "../../../features/agents/labels";
import type { ProjectOption } from "../../../features/agents/model";
import type { NewDraft } from "../../../features/agents/store";
import { AttachmentDrafts } from "../shared/AttachmentDrafts";
import { GLYPH_SIZE } from "../shared/constants";
import { ProjectPicker } from "./ProjectPicker";
import { SuggestionChips } from "./SuggestionChips";
import styles from "./NewConversationView.module.css";

export interface NewConversationViewProps {
  draft: NewDraft;
  options: readonly ProjectOption[];
  attachments: AgentAttachments;
  busy: boolean;
  error: string | null;
  focusToken: number;
  onDraft(patch: Partial<NewDraft>): void;
  onSubmit(prompt: string): void;
  onClose(): void;
}

export function NewConversationView({ draft, options, attachments, busy, error, focusToken, onDraft, onSubmit, onClose }: NewConversationViewProps) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, [focusToken]);
  const pick = (prompt: string) => {
    onDraft({ prompt });
    inputRef.current?.focus();
  };
  return (
    <div className={styles.scroller}>
      <div className={styles.column}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.breadcrumb}>
              <span className={styles.crumbChip}>
                <Icon name="agents" size={GLYPH_SIZE} color="text-secondary" />
                <Text variant="caption" color="text-secondary">
                  {AGENTS_LABELS.title}
                </Text>
              </span>
              <Icon name="caret-right" size={GLYPH_SIZE} color="text-tertiary" />
              <Text variant="label">{NEW_LABELS.title}</Text>
            </div>
            <IconButton icon="close" label={NEW_LABELS.close} onClick={onClose} />
          </div>
          <Composer
            large
            value={draft.prompt}
            onChange={(prompt) => onDraft({ prompt })}
            onSubmit={onSubmit}
            placeholder={NEW_LABELS.placeholder}
            sendLabel={NEW_LABELS.send}
            busy={busy}
            hasAttachments={attachments.hasItems}
            attachmentsBlocked={attachments.blocked}
            onAttach={attachments.attach}
            onDropFiles={attachments.dropFiles}
            inputRef={inputRef}
            properties={<ProjectPicker options={options} value={draft.projectId} onChange={(projectId) => onDraft({ projectId })} />}
            tray={<AttachmentDrafts attachments={attachments} />}
          />
        </div>
        {error ? <Notice tone="danger" message={error} /> : null}
        <SuggestionChips onPick={pick} />
      </div>
    </div>
  );
}
