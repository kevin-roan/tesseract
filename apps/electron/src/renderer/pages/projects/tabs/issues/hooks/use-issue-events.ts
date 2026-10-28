import { useServerEvent } from "../../../../../app/connection";
import type { IssuesCache } from "./use-issues-cache";

export function useIssueEvents(projectId: string, cache: IssuesCache): void {
  useServerEvent("issue.updated", (event) => {
    if (event.issue.projectId === projectId) cache.upsert(event.issue);
  });
  useServerEvent("issue.deleted", (event) => {
    if (event.projectId === projectId) cache.remove(event.id);
  });
  useServerEvent("issue.commented", (event) => {
    if (event.projectId === projectId) cache.addComment(event.comment);
  });
  useServerEvent("hello", () => cache.refresh());
}
