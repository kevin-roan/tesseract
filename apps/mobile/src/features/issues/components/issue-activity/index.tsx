import type { IssueComment as IssueCommentData } from "@tesseract/protocol";

import MotionItem from "@/components/motion-item";
import Section from "@/components/section";

import { ISSUE_DETAIL_COPY } from "../../utils/content";
import IssueComment from "../issue-comment";

export type IssueActivityProps = {
  comments: readonly IssueCommentData[] | null;
  loading: boolean;
  onOpenRun?: (runId: string) => void;
};

const IssueActivity = ({ comments, loading, onOpenRun }: IssueActivityProps) => (
  <Section
    title={ISSUE_DETAIL_COPY.activity}
    loading={loading && comments === null}
    isEmpty={comments !== null && comments.length === 0}
    emptyLabel={ISSUE_DETAIL_COPY.noActivity}
    testID="issue-activity"
  >
    {(comments ?? []).map((comment) => (
      <MotionItem key={comment.id}>
        <IssueComment comment={comment} onOpenRun={onOpenRun} />
      </MotionItem>
    ))}
  </Section>
);

export default IssueActivity;
