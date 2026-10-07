import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { MarkdownView } from "../MarkdownView";
import { AuthorLine } from "./AuthorLine";
import { TIMELINE_LABELS } from "./labels";
import styles from "./Timeline.module.css";

export interface AssistantMessageProps {
  text: string;
  author?: string | null;
  avatar?: ReactNode;
  working?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
  className?: string;
}

export function AssistantMessage({
  text,
  author,
  avatar,
  working = false,
  copyLabel = TIMELINE_LABELS.copy,
  copiedLabel = TIMELINE_LABELS.copied,
  className,
}: AssistantMessageProps) {
  return (
    <div className={cx(styles.assistantMessage, className)} data-working={working || undefined}>
      {author ? (
        <AuthorLine avatar={avatar ?? <span className={styles.agentAvatar} aria-hidden />} name={author} />
      ) : null}
      <MarkdownView text={text} copyLabel={copyLabel} copiedLabel={copiedLabel} className={styles.messageBody} />
    </div>
  );
}
