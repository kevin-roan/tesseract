import { useQueryClient } from "@tanstack/react-query";
import type { Issue, IssueComment, IssueDetail, UpdateIssue } from "@tesseract/protocol";
import { useMemo } from "react";
import { DATA_KEYS, useApiClient } from "../../../../../app/data";
import { ISSUES_QUERY_KEYS } from "../constants";
import { appendComment, applyIssuePatch, mergeDetail, patchIssue, removeIssue, upsertIssue } from "../model";

export interface IssuesCache {
  find(id: string): Issue | null;
  list(): Issue[] | null;
  upsert(issue: Issue): void;
  patch(id: string, patch: UpdateIssue): void;
  remove(id: string): void;
  addComment(comment: IssueComment): void;
  refresh(): void;
  refreshDetail(id: string): void;
}

export function useIssuesCache(projectId: string): IssuesCache {
  const queryClient = useQueryClient();
  const baseUrl = useApiClient()?.baseUrl ?? "none";
  return useMemo(() => {
    const listKey = DATA_KEYS.api(baseUrl, ...ISSUES_QUERY_KEYS.list(projectId));
    const detailKey = (id: string) => DATA_KEYS.api(baseUrl, ...ISSUES_QUERY_KEYS.detail(id));
    const updateList = (fn: (issues: Issue[]) => Issue[]) =>
      queryClient.setQueryData<Issue[]>(listKey, (current) => (current === undefined ? current : fn(current)));
    const updateDetail = (id: string, fn: (detail: IssueDetail) => IssueDetail) =>
      queryClient.setQueryData<IssueDetail>(detailKey(id), (current) => (current === undefined ? current : fn(current)));
    const list = () => queryClient.getQueryData<Issue[]>(listKey) ?? null;
    return {
      list,
      find: (id) => list()?.find((issue) => issue.id === id) ?? null,
      upsert: (issue) => {
        updateList((issues) => upsertIssue(issues, issue));
        updateDetail(issue.id, (detail) => mergeDetail(detail, issue));
      },
      patch: (id, patch) => {
        updateList((issues) => patchIssue(issues, id, patch));
        updateDetail(id, (detail) => applyIssuePatch(detail, patch));
      },
      remove: (id) => {
        updateList((issues) => removeIssue(issues, id));
        queryClient.removeQueries({ queryKey: detailKey(id) });
      },
      addComment: (comment) => updateDetail(comment.issueId, (detail) => appendComment(detail, comment)),
      refresh: () => void queryClient.invalidateQueries({ queryKey: listKey }),
      refreshDetail: (id) => void queryClient.invalidateQueries({ queryKey: detailKey(id) }),
    };
  }, [queryClient, baseUrl, projectId]);
}
