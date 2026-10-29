import { useCallback, useMemo, useState } from "react";
import type { IssueStatus } from "@tesseract/protocol";

import type { HeaderAction } from "@/components/screen-header";
import { useProject, useProjects } from "@/features/sandbox/hooks/use-sandbox-queries";
import { useSandboxRefresh } from "@/features/sandbox/hooks/use-sandbox-refresh";
import { describeError } from "@/features/sandbox/utils/errors";

import { ISSUE_ACTIONS, ISSUES_COPY } from "../utils/content";
import { countOpenIssues, filterIssues, groupIssues, initialCollapsed, type IssueFilterId } from "../utils/issues";
import { useIssueForm } from "./use-issue-form";
import { useIssueNavigation } from "./use-issue-navigation";
import { useAllIssues, useProjectIssues } from "./use-issue-queries";
import { useIssueStatusSheet } from "./use-issue-status-sheet";

/** One project's issues, or every project's when `projectId` is empty (the drawer's Issues entry). */
export function useProjectIssuesScreen(projectId: string) {
  const everyProject = projectId.length === 0;
  const nav = useIssueNavigation();
  const project = useProject(projectId);
  const projectIssues = useProjectIssues(projectId);
  const allIssues = useAllIssues(everyProject);
  const issues = everyProject ? allIssues : projectIssues;
  const projects = useProjects();
  const projectOptions = useMemo(
    () => (everyProject ? (projects.data ?? []).map((item) => ({ value: item.id, label: item.name })) : []),
    [everyProject, projects.data],
  );
  const statusSheet = useIssueStatusSheet();
  const form = useIssueForm(everyProject ? null : projectId, undefined, projectOptions);
  const { refreshing, refresh } = useSandboxRefresh();
  const [filter, setFilter] = useState<IssueFilterId>("all");
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const all = issues.data;
  const groups = useMemo(() => groupIssues(filterIssues(all ?? [], filter)), [all, filter]);
  const toggleGroup = useCallback(
    (status: IssueStatus) => setCollapsed((current) => ({ ...current, [status]: !current[status] })),
    [],
  );

  const openForm = form.open;
  const headerActions = useMemo<HeaderAction[]>(() => [{ ...ISSUE_ACTIONS.create, onPress: openForm }], [openForm]);

  return {
    everyProject,
    projectName: everyProject ? ISSUES_COPY.allProjects : (project.data?.name ?? projectId),
    noProjects: everyProject && projects.isSuccess && projectOptions.length === 0,
    back: nav.back,
    open: nav.issue,
    headerActions,
    loading: issues.isLoading,
    error: issues.error ? describeError(issues.error) : null,
    retry: () => void issues.refetch(),
    total: all?.length ?? 0,
    openCount: countOpenIssues(all ?? []),
    filter,
    setFilter,
    groups,
    isCollapsed: (status: IssueStatus) => collapsed[status],
    toggleGroup,
    changeStatus: statusSheet.open,
    statusSheet: statusSheet.sheet,
    actionError: statusSheet.error,
    newIssue: openForm,
    form: form.sheet,
    refreshing,
    refresh,
  };
}
