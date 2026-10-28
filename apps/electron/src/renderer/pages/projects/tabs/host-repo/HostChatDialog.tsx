import type { TesseractClient } from "@tesseract/client";
import { ApiClientScope } from "../../../../app/data";
import { ChoiceDropdown } from "../../../../components/ChoiceDropdown";
import { Composer } from "../../../../components/Composer";
import { DialogShell } from "../../../../components/DialogShell";
import { Notice } from "../../../../components/Notice";
import { Text } from "../../../../components/Text";
import { ConversationView } from "../../../agents/conversation";
import { AttachmentDrafts } from "../../../agents/shared/AttachmentDrafts";
import { ModelPicker } from "../../../agents/shared/ModelPicker";
import { HOST_CHAT_WIDTH } from "./constants";
import { useHostChat } from "./hooks/use-host-chat";
import { HOST_REPO_LABELS as L } from "./labels";
import { NEW_CHAT } from "./model";
import styles from "./HostChatDialog.module.css";

export interface HostChatDialogProps {
  open: boolean;
  client: TesseractClient | null;
  projectId: string;
  folder: string;
  onClose(): void;
}

export function HostChatDialog({ open, client, projectId, folder, onClose }: HostChatDialogProps) {
  return (
    <DialogShell
      open={open && client !== null}
      title={L.chatTitle}
      context={{ label: folder, icon: "host" }}
      width={HOST_CHAT_WIDTH}
      onClose={onClose}
      className={styles.sheet}
      bodyClassName={styles.body}
    >
      {client ? (
        <ApiClientScope client={client}>
          <HostChat projectId={projectId} />
        </ApiClientScope>
      ) : null}
    </DialogShell>
  );
}

function HostChat({ projectId }: { projectId: string }) {
  const chat = useHostChat(projectId);
  return (
    <>
      <div className={styles.bar}>
        <ChoiceDropdown options={chat.options} value={chat.runId ?? NEW_CHAT} onChange={chat.select} ariaLabel={L.chats} tooltip={L.chats} />
        {chat.account.options ? (
          <ChoiceDropdown
            options={chat.account.options}
            value={chat.account.value}
            onChange={chat.account.change}
            disabled={chat.account.busy}
            ariaLabel={L.account}
            tooltip={L.account}
          />
        ) : null}
        <Text variant="caption" color="warning" className={styles.hint}>
          {L.chatHint}
        </Text>
      </div>
      {chat.runId ? (
        <ConversationView key={chat.runId} runId={chat.runId} compact onSelectRun={chat.select} className={styles.conversation} />
      ) : (
        <div className={styles.start}>
          <Composer
            large
            autoFocus
            value={chat.prompt}
            onChange={chat.setPrompt}
            onSubmit={chat.submit}
            placeholder={L.chatPlaceholder}
            sendLabel={L.chatSend}
            busy={chat.busy}
            hasAttachments={chat.attachments.hasItems}
            attachmentsBlocked={chat.attachments.blocked}
            onAttach={chat.attachments.attach}
            onDropFiles={chat.attachments.dropFiles}
            properties={<ModelPicker value={chat.model} onChange={chat.setModel} />}
            tray={<AttachmentDrafts attachments={chat.attachments} />}
          />
          {chat.error ? <Notice tone="danger" message={chat.error} /> : null}
        </div>
      )}
    </>
  );
}
