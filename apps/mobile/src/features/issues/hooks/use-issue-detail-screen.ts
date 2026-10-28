import { useCallback, useMemo } from "react";
import { ApiError } from "@tesseract/client";
import type { Issue, UpdateIssue } from "@tesseract/protocol";

import type { HeaderAction } from "@/components/screen-header";
import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { useSandboxRefresh } from "@/features/sandbox/hooks/use-sandbox-refresh";
import { describeError } from "@/features/sandbox/utils/errors";
import { confirm } from "@/lib/confirm";

import { DELETE_ISSUE_CONFIRM, ISSUE_ACTIONS, ISSUE_DETAIL_COPY } from "../utils/content";
import {
  assigneeChoice,
  assigneeFromChoice,
  canDispatch,
  isAssigneeChoice,
  isClosedStatus,
  isIssuePriority,
  isIssueRunning,
  isIssueStatus,
  issueIdentifier,
} from "../utils/issues";
import { useDraftText } from "./use-draft-text";
import { useIssueComposer } from "./use-issue-composer";
import { useIssueLabels } from "./use-issue-labels";
import { useDeleteIssue, useDispatchIssue, useUpdateIssue } from "./use-issue-mutations";
import { useIssueNavigation } from "./use-issue-navigation";
import { useCachedIssue, useIssueDetail } from "./use-issue-queries";

const NO_LABELS: string[] = [];

function claudeHint(issue: Pick<Issue, "status" | "agentState">): string | null {
  if (isIssueRunning(issue)) return ISSUE_DETAIL_COPY.running;
  if (isClosedStatus(issue.status)) return ISSUE_DETAIL_COPY.closedHint;
  if (issue.status === "backlog") return ISSUE_DETAIL_COPY.backlogHint;
  return null;
}

export function useIssueDetailScreen(issueId: string) {
  const nav = useIssueNavigation();
  const sandboxNav = useSandboxNavigation();
  const detail = useIssueDetail(issueId);
  const cached = useCachedIssue(issueId);
  const issue = detail.data ?? cached;
  const update = useUpdateIssue();
  const dispatch = useDispatchIssue();
  const remove = useDeleteIssue();
  const { refreshing, refresh } = useSandboxRefresh();
  const { mutate: mutateUpdate } = update;
  const { mutate: mutateDispatch } = dispatch;
  const { mutate: mutateDelete } = remove;

  const save = useCallback((patch: UpdateIssue) => mutateUpdate({ id: issueId, ...patch }), [mutateUpdate, issueId]);
  const saveTitle = useCallback((title: string) => save({ title }), [save]);
  const saveDescription = useCallback((description: string) => save({ description }), [save]);
  const saveLabels = useCallback((labels: string[]) => save({ labels }), [save]);

  const title = useDraftText(issue?.title ?? "", saveTitle, true);
  const description = useDraftText(issue?.description ?? "", saveDescription);
  const labels = useIssueLabels(issue?.labels ?? NO_LABELS, saveLabels);
  const composer = useIssueComposer(issueId, issue?.assignee ?? null);

  const selectStatus = useCallback((id: string) => isIssueStatus(id) && save({ status: id }), [save]);
  const selectPriority = useCallback((id: string) => isIssuePriority(id) && save({ priority: id }), [save]);
  const selectAssignee = useCallback(
    (id: string) => isAssigneeChoice(id) && save({ assignee: assigneeFromChoice(id) }),
    [save],
  );

  const runNow = useCallback(() => mutateDispatch({ issueId }), [mutateDispatch, issueId]);

  const agentRunId = issue?.agentRunId ?? null;
  const viewRun = useMemo(() => (agentRunId ? () => sandboxNav.agentRun(agentRunId) : undefined), [agentRunId, sandboxNav]);

  const back = nav.back;
  const deleteIssue = useCallback(async () => {
    if (!(await confirm(DELETE_ISSUE_CONFIRM))) return;
    mutateDelete(issueId, { onSuccess: back });
  }, [mutateDelete, issueId, back]);

  const headerActions = useMemo<HeaderAction[]>(
    () => (issue ? [{ ...ISSUE_ACTIONS.delete, onPress: () => void deleteIssue(), disabled: remove.isPending }] : []),
    [issue, deleteIssue, remove.isPending],
  );

  const requestError = update.error ?? dispatch.error ?? remove.error;
  const missing = !issue && detail.error instanceof ApiError && detail.error.status === 404;

  return {
    issue,
    identifier: issue ? issueIdentifier(issue) : ISSUE_DETAIL_COPY.title,
    back,
    headerActions,
    loading: !issue && detail.isLoading,
    missing,
    error: !issue && detail.error ? describeError(detail.error) : null,
    retry: () => void detail.refetch(),
    actionError: requestError ? describeError(requestError) : null,
    title,
    description,
    properties: {
      status: issue?.status ?? null,
      priority: issue?.priority ?? null,
      assignee: issue ? assigneeChoice(issue.assignee) : null,
      labels: issue?.labels ?? NO_LABELS,
      selectStatus,
      selectPriority,
      selectAssignee,
      editLabels: labels.open,
    },
    labelsSheet: labels.sheet,
    claude: {
      running: issue ? isIssueRunning(issue) : false,
      agentState: issue?.agentState ?? null,
      canRun: issue ? canDispatch(issue) && !dispatch.isPending : false,
      dispatching: dispatch.isPending,
      runLabel: agentRunId ? ISSUE_DETAIL_COPY.rerun : ISSUE_DETAIL_COPY.runNow,
      hint: issue ? claudeHint(issue) : null,
      runNow,
      viewRun,
    },
    comments: detail.data?.comments ?? null,
    commentsLoading: detail.isLoading,
    openRun: sandboxNav.agentRun,
    composer,
    refreshing,
    refresh,
  };
}

export type IssueDetailState = ReturnType<typeof useIssueDetailScreen>;
