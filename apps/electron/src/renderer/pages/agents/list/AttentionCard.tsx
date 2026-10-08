import type { InboxItem } from "@tesseract/protocol";
import { motion } from "motion/react";
import { Icon } from "../../../components/Icon";
import { Text } from "../../../components/Text";
import { formatRelativeTime } from "../../../features/agents/format";
import { ATTENTION_LABELS, ATTENTION_OPEN_LABELS } from "../../../features/agents/labels";
import { attentionMeta, attentionOpenTarget, noticeStyle, type ProjectNames } from "../../../features/agents/model";
import { TONE_COLORS } from "../../../theme/colors";
import { rise } from "../../../theme/motion";
import { GLYPH_SIZE } from "../shared/constants";
import styles from "./ConversationList.module.css";

export interface AttentionCardProps {
  item: InboxItem;
  names: ProjectNames;
  now: number;
  onOpen(item: InboxItem): void;
  onMarkRead(item: InboxItem): void;
}

export function AttentionCard({ item, names, now, onOpen, onMarkRead }: AttentionCardProps) {
  const style = noticeStyle(item);
  const target = attentionOpenTarget(item);
  const meta = attentionMeta(item, names);
  return (
    <motion.div className={styles.attentionCard} variants={rise} initial="initial" animate="animate" exit="exit" layout="position" data-inbox-id={item.id}>
      <span className={styles.cardGlyph}>
        <Icon name={style.icon} size={GLYPH_SIZE} color={TONE_COLORS[style.tone].fg} />
      </span>
      <div className={styles.rowText}>
        <div className={styles.rowTop}>
          <Text variant="label" className={styles.grow}>
            {item.title}
          </Text>
          <Text variant="caption" color="text-tertiary" className={styles.time}>
            {formatRelativeTime(item.updatedAt, now)}
          </Text>
        </div>
        {meta ? (
          <Text variant="caption" color="text-secondary" wrap lines={2}>
            {meta}
          </Text>
        ) : null}
        <div className={styles.cardActions}>
          {target ? (
            <button type="button" className={styles.flatButton} onClick={() => onOpen(item)}>
              {ATTENTION_OPEN_LABELS[target.kind]}
            </button>
          ) : null}
          <button type="button" className={styles.flatButton} onClick={() => onMarkRead(item)}>
            {ATTENTION_LABELS.markRead}
          </button>
        </div>
      </div>
      <span className={styles.cardDot} aria-hidden />
    </motion.div>
  );
}
