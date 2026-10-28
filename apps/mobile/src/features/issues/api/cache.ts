import type { QueryClient } from "@tanstack/react-query";
import type { Issue, IssueComment, IssueDetail, ServerEventOf } from "@tesseract/protocol";

import { filterFromKey, matchesFilter } from "@/features/sandbox/api/query-keys";
import { removeByIds, upsertById } from "@/features/sandbox/utils/collections";

import { issueKeys } from "./query-keys";

export type IssueEvent = ServerEventOf<"issue.updated" | "issue.deleted" | "issue.commented">;

export function storeIssue(queryClient: QueryClient, sandboxId: string, issue: Issue): void {
  for (const [queryKey, data] of queryClient.getQueriesData<Issue[]>({ queryKey: issueKeys.lists(sandboxId) })) {
    if (!data || !matchesFilter(filterFromKey(queryKey), issue.projectId)) continue;
    queryClient.setQueryData<Issue[]>(queryKey, upsertById(data, issue));
  }
  queryClient.setQueryData<IssueDetail>(issueKeys.detail(sandboxId, issue.id), (detail) =>
    detail ? { ...detail, ...issue } : detail,
  );
}

export function removeIssue(queryClient: QueryClient, sandboxId: string, issueId: string): void {
  queryClient.setQueriesData<Issue[]>({ queryKey: issueKeys.lists(sandboxId) }, (data) =>
    data ? removeByIds(data, [issueId]) : data,
  );
  queryClient.removeQueries({ queryKey: issueKeys.detail(sandboxId, issueId), exact: true });
}

export function storeIssueComment(queryClient: QueryClient, sandboxId: string, comment: IssueComment): void {
  queryClient.setQueryData<IssueDetail>(issueKeys.detail(sandboxId, comment.issueId), (detail) =>
    detail && !detail.comments.some((entry) => entry.id === comment.id)
      ? { ...detail, comments: [...detail.comments, comment] }
      : detail,
  );
}

export function cachedIssue(queryClient: QueryClient, sandboxId: string, issueId: string): Issue | undefined {
  const detail = queryClient.getQueryData<IssueDetail>(issueKeys.detail(sandboxId, issueId));
  if (detail) return detail;
  for (const [, data] of queryClient.getQueriesData<Issue[]>({ queryKey: issueKeys.lists(sandboxId) })) {
    const issue = data?.find((entry) => entry.id === issueId);
    if (issue) return issue;
  }
  return undefined;
}

export function applyIssueEvent(queryClient: QueryClient, sandboxId: string, event: IssueEvent): void {
  switch (event.type) {
    case "issue.updated":
      return storeIssue(queryClient, sandboxId, event.issue);
    case "issue.deleted":
      return removeIssue(queryClient, sandboxId, event.id);
    case "issue.commented":
      return storeIssueComment(queryClient, sandboxId, event.comment);
  }
}
