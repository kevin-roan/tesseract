import { cx } from "../../lib/cx";
import { TONE_COLORS, type Tone } from "../../theme/colors";
import type { IconName } from "../../theme/icons";
import { Icon } from "../Icon";
import { MarkdownView } from "../MarkdownView";
import { Text } from "../Text";
import { ActivityRow } from "./ActivityRow";
import { TIMELINE_LABELS } from "./labels";
import styles from "./Timeline.module.css";

export interface OutcomeCardProps {
  title: string;
  meta?: string | null;
  tone: Tone;
  icon: IconName;
  body?: string | null;
  error?: string | null;
  className?: string;
}

export function OutcomeCard({ title, meta, tone, icon, body, error, className }: OutcomeCardProps) {
  const toneColor = TONE_COLORS[tone].fg;
  return (
    <div className={cx(styles.outcome, className)}>
      <ActivityRow glyph={<Icon name={icon} color={toneColor} />}>
        <Text variant="overline" color={toneColor}>
          {title}
        </Text>
        {meta ? (
          <Text variant="caption" color="text-tertiary" className={styles.grow}>
            {meta}
          </Text>
        ) : null}
      </ActivityRow>
      {error ? (
        <Text variant="bodySmall" color="danger" wrap lines={null} selectable className={cx(styles.messageBody, styles.preWrap)}>
          {error}
        </Text>
      ) : null}
      {body ? (
        <MarkdownView
          text={body}
          copyLabel={TIMELINE_LABELS.copy}
          copiedLabel={TIMELINE_LABELS.copied}
          className={styles.messageBody}
        />
      ) : null}
    </div>
  );
}
