import { Notice } from "../Notice";
import { Text } from "../Text";
import { LinkField } from "./LinkField";
import { LinkInput } from "./LinkInput";
import type { PairPanelModel } from "./model";
import { QrTile } from "./QrTile";
import { SetupSteps } from "./SetupSteps";
import type { PairLinkDraft } from "./use-pair-dialog";
import styles from "./PairDialog.module.css";

export interface PairPanelProps {
  model: PairPanelModel;
  instructions: string;
  secret: string;
  copyLabel: string;
  onCopy(link: string): void;
  stepsLabel?: string;
  copyCommandLabel?: string;
  onCopyCommand?: (command: string) => void;
  linkDraft?: PairLinkDraft;
}

export function PairPanel({
  model,
  instructions,
  secret,
  copyLabel,
  onCopy,
  stepsLabel = "",
  copyCommandLabel = copyLabel,
  onCopyCommand = onCopy,
  linkDraft,
}: PairPanelProps) {
  return (
    <div className={styles.panel}>
      {model.link ? (
        <>
          <QrTile value={model.link} />
          <Text variant="body" color="text-secondary" wrap lines={null} center>
            {instructions}
          </Text>
          <LinkField value={model.link} copyLabel={copyLabel} onCopy={onCopy} />
        </>
      ) : null}
      {model.caption ? (
        <Text variant="caption" color="text-tertiary" center className={styles.caption}>
          {model.caption}
        </Text>
      ) : null}
      {model.notices.length > 0 ? (
        <div className={styles.notices}>
          {model.notices.map((notice) => (
            <Notice
              key={notice.id}
              tone={notice.tone}
              message={notice.message}
              actionLabel={notice.actionLabel}
              onAction={notice.onAction}
            />
          ))}
        </div>
      ) : null}
      {model.steps.length > 0 ? (
        <SetupSteps
          steps={model.steps}
          label={stepsLabel}
          copyLabel={copyCommandLabel}
          onCopy={onCopyCommand}
          input={
            model.linkInput && linkDraft ? (
              <LinkInput
                descriptor={model.linkInput}
                value={linkDraft.value}
                error={linkDraft.error}
                busy={linkDraft.busy}
                onChange={linkDraft.setValue}
                onSubmit={linkDraft.submit}
              />
            ) : null
          }
        />
      ) : null}
      <Notice tone="warning" message={secret} />
    </div>
  );
}
