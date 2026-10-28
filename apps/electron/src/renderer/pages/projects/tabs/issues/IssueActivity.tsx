import type { Issue, IssueComment } from "@tesseract/protocol";
import { Avatar } from "../../../../components/Avatar";
import { ClaudeMark } from "../../../../components/ClaudeMark";
import { Composer } from "../../../../components/Composer";
import { MarkdownView } from "../../../../components/MarkdownView";
import { Spinner } from "../../../../components/Spinner";
import { Text } from "../../../../components/Text";
import { AuthorLine, SystemLine } from "../../../../components/Timeline";
import { formatRelativeTime } from "../../../../features/projects/format";
import { GLYPH_SIZE } from "./constants";
import { AUTHOR_LABELS, SHEET_LABELS as L } from "./labels";
import { commentFollowsUp } from "./model";
import styles from "./IssueSheet.module.css";

export interface IssueActivityProps {
  issue: Issue;
  comments: readonly IssueComment[] | null;
  draft: string;
  sending: boolean;
  onDraft(value: string): void;
  onSend(body: string): void;
}

export function IssueActivity({ issue, comments, draft, sending, onDraft, onSend }: IssueActivityProps) {
  return (
    <section className={styles.section} aria-label={L.activity}>
      <div className={styles.sectionHeader}>
        <Text variant="overline" color="text-secondary">
          {L.activity}
        </Text>
      </div>
      {comments === null ? (
        <Spinner size={16} label={L.loading} />
      ) : comments.length === 0 ? (
        <Text variant="body" color="text-tertiary">
          {L.noActivity}
        </Text>
      ) : (
        <ol className={styles.feed} aria-label={L.activity}>
          {comments.map((comment) => (
            <li key={comment.id} className={styles.entry} data-author={comment.author}>
              <CommentEntry comment={comment} />
            </li>
          ))}
        </ol>
      )}
      <Composer
        value={draft}
        onChange={onDraft}
        onSubmit={onSend}
        busy={sending}
        placeholder={commentFollowsUp(issue) ? L.followUpPlaceholder : L.commentPlaceholder}
        sendLabel={L.comment}
      />
    </section>
  );
}

function CommentEntry({ comment }: { comment: IssueComment }) {
  if (comment.author === "system") return <SystemLine text={comment.body} />;
  const avatar =
    comment.author === "claude" ? (
      <ClaudeMark size={GLYPH_SIZE.avatar} badge />
    ) : (
      <Avatar name={AUTHOR_LABELS.me} size={GLYPH_SIZE.avatar} />
    );
  return (
    <>
      <AuthorLine avatar={avatar} name={AUTHOR_LABELS[comment.author]} time={formatRelativeTime(comment.createdAt)} />
      <MarkdownView text={comment.body} className={styles.commentBody} />
    </>
  );
}
