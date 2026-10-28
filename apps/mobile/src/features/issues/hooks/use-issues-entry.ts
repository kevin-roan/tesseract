import { countOpenIssues } from "../utils/issues";
import { useIssueNavigation } from "./use-issue-navigation";
import { useProjectIssues } from "./use-issue-queries";

export function useIssuesEntry(projectId: string) {
  const nav = useIssueNavigation();
  const issues = useProjectIssues(projectId);
  const openCount = countOpenIssues(issues.data ?? []);
  return { openCount, open: () => nav.list(projectId) };
}
