import { type ReactNode, useState } from "react";
import { defineGalleryEntry } from "../../app/define";
import { AttachmentChip } from "./AttachmentChip";
import { AttachmentTray } from "./AttachmentTray";
import { Composer } from "./Composer";
import { COMPOSER_ATTACHMENTS, COMPOSER_GALLERY, COMPOSER_LOCKED_REASON, COMPOSER_SLASH_COMMANDS, noop } from "./gallery-samples";
import { COMPOSER_LABELS } from "./labels";
import styles from "./Composer.gallery.module.css";

function ComposerCase({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.case}>
      <span className={styles.caption}>{title}</span>
      {children}
    </div>
  );
}

function ComposerGallery() {
  const [reply, setReply] = useState("");
  const [draft, setDraft] = useState<string>(COMPOSER_GALLERY.draft);
  const [attachments, setAttachments] = useState(COMPOSER_ATTACHMENTS);
  const [busy, setBusy] = useState(true);
  return (
    <div className={styles.stack}>
      <ComposerCase title={COMPOSER_GALLERY.groupLabels.followUp}>
        <Composer
          value={reply}
          onChange={setReply}
          onSubmit={noop}
          placeholder={COMPOSER_LABELS.followUpPlaceholder}
          sendLabel={COMPOSER_LABELS.followUpSend}
          maxHeight={200}
          onAttach={noop}
          onDropFiles={noop}
          slashCommands={COMPOSER_SLASH_COMMANDS}
        />
      </ComposerCase>
      <ComposerCase title={COMPOSER_GALLERY.groupLabels.draft}>
        <Composer
          value={draft}
          onChange={setDraft}
          onSubmit={noop}
          placeholder={COMPOSER_LABELS.followUpPlaceholder}
          sendLabel={COMPOSER_LABELS.followUpSend}
          maxHeight={200}
          hint={COMPOSER_GALLERY.hint}
          hasAttachments={attachments.length > 0}
          attachmentsBlocked={attachments.some((item) => item.status === "uploading" || item.status === "error")}
          onAttach={noop}
          tray={
            <AttachmentTray>
              {attachments.map(({ id, ...item }) => (
                <AttachmentChip key={id} {...item} onRemove={() => setAttachments((list) => list.filter((entry) => entry.id !== id))} onRetry={noop} />
              ))}
            </AttachmentTray>
          }
        />
      </ComposerCase>
      <ComposerCase title={COMPOSER_GALLERY.groupLabels.locked}>
        <Composer
          value=""
          onChange={noop}
          onSubmit={noop}
          placeholder={COMPOSER_LABELS.followUpPlaceholder}
          sendLabel={COMPOSER_LABELS.followUpSend}
          locked={COMPOSER_LOCKED_REASON}
          onAttach={noop}
        />
      </ComposerCase>
      <ComposerCase title={COMPOSER_GALLERY.groupLabels.busy}>
        <Composer
          value={COMPOSER_GALLERY.draft}
          onChange={noop}
          onSubmit={noop}
          placeholder={COMPOSER_LABELS.followUpPlaceholder}
          sendLabel={COMPOSER_LABELS.followUpSend}
          busy={busy}
          onStop={() => setBusy(false)}
          stopLabel={COMPOSER_GALLERY.stop}
          onAttach={noop}
        />
      </ComposerCase>
    </div>
  );
}

export default defineGalleryEntry({
  id: "composer",
  title: "Composer",
  group: "Composer",
  width: COMPOSER_GALLERY.width,
  render: () => <ComposerGallery />,
});
