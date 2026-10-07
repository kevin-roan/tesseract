import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Text } from "../Text";
import { AuthorLine } from "./AuthorLine";
import { InitialsAvatar } from "./InitialsAvatar";
import { TIMELINE_LABELS } from "./labels";
import styles from "./Timeline.module.css";

export interface UserBubbleProps {
  text: string;
  author?: string;
  time?: string;
  avatar?: ReactNode;
  attachments?: ReactNode;
  className?: string;
}

export function UserBubble({ text, author = TIMELINE_LABELS.you, time, avatar, attachments, className }: UserBubbleProps) {
  return (
    <div className={cx(styles.userMessage, className)}>
      <AuthorLine avatar={avatar ?? <InitialsAvatar name={author} />} name={author} time={time} />
      <Text variant="body" wrap lines={null} selectable className={cx(styles.messageBody, styles.preWrap)}>
        {text}
      </Text>
      {attachments ? <div className={cx(styles.messageBody, styles.attachments)}>{attachments}</div> : null}
    </div>
  );
}
