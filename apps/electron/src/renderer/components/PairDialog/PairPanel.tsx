import { Notice } from "../Notice";
import { Text } from "../Text";
import { LinkField } from "./LinkField";
import type { PairPanelModel } from "./model";
import { QrTile } from "./QrTile";
import styles from "./PairDialog.module.css";

export interface PairPanelProps {
  model: PairPanelModel;
  instructions: string;
  secret: string;
  copyLabel: string;
  onCopy(link: string): void;
}

export function PairPanel({ model, instructions, secret, copyLabel, onCopy }: PairPanelProps) {
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
      <Notice tone="warning" message={secret} />
    </div>
  );
}
