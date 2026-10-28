import { useCallback, useState } from "react";
import type { IssueAssignee } from "@tesseract/protocol";

import { describeError } from "@/features/sandbox/utils/errors";

import { ISSUE_DETAIL_COPY } from "../utils/content";
import { useCommentOnIssue } from "./use-issue-mutations";

export function useIssueComposer(issueId: string, assignee: IssueAssignee | null) {
  const comment = useCommentOnIssue();
  const { mutate } = comment;
  const [text, setText] = useState("");
  const body = text.trim();

  const send = useCallback(() => {
    if (!body || comment.isPending) return;
    mutate({ issueId, body }, { onSuccess: () => setText("") });
  }, [body, comment.isPending, mutate, issueId]);

  return {
    text,
    setText,
    send,
    canSend: body.length > 0,
    sending: comment.isPending,
    placeholder: assignee === "claude" ? ISSUE_DETAIL_COPY.claudeCommentPlaceholder : ISSUE_DETAIL_COPY.commentPlaceholder,
    error: comment.error ? describeError(comment.error) : null,
  };
}

export type IssueComposerState = ReturnType<typeof useIssueComposer>;
