import type { IssueStatus } from "@tesseract/protocol";
import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigateTo } from "../../../../../app/navigation";
import type { TabHost } from "../../../../../features/projects/hooks/use-tab-host";
import { filterIssues, issueColumns, issuesView, knownLabels } from "../model";
import type { IssueLayout, IssueScope } from "../types";
import { useBoardDrag } from "./use-board-drag";
import { useCreateShortcut } from "./use-create-shortcut";
import { useIssueActions } from "./use-issue-actions";
import { useIssueEvents } from "./use-issue-events";
import { useIssueList } from "./use-issue-list";
import { useIssuesCache } from "./use-issues-cache";

export interface IssuesTabInput {
  projectId: string;
  host: TabHost;
}

export function useIssuesTab({ projectId, host }: IssuesTabInput) {
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigateTo();
  const cache = useIssuesCache(projectId);
  const list = useIssueList(projectId, host.visible);
  useIssueEvents(projectId, cache);
  const actions = useIssueActions(projectId, cache, host.report);

  const [scope, setScope] = useState<IssueScope>("all");
  const [layout, setLayout] = useState<IssueLayout>("board");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createStatus, setCreateStatus] = useState<IssueStatus | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const openCreate = useCallback((status: IssueStatus | null = null) => {
    setCreateStatus(status);
    setCreateOpen(true);
  }, []);
  const closeCreate = useCallback(() => setCreateOpen(false), []);
  const closeSheet = useCallback(() => setSelectedId(null), []);
  useCreateShortcut(rootRef, host.visible && !createOpen, openCreate);

  const issues = list.issues;
  const visible = useMemo(() => (issues ? filterIssues(issues, scope) : []), [issues, scope]);
  const columns = useMemo(() => issueColumns(visible), [visible]);
  const labels = useMemo(() => knownLabels(issues ?? []), [issues]);
  const selected = useMemo(() => issues?.find((issue) => issue.id === selectedId) ?? null, [issues, selectedId]);

  const drag = useBoardDrag(actions.move);

  const create = useCallback(
    async (...args: Parameters<typeof actions.create>) => {
      const issue = await actions.create(...args);
      if (issue) setCreateOpen(false);
      return issue;
    },
    [actions],
  );

  const viewRun = useCallback((runId: string) => navigate("agents", { runId }), [navigate]);

  return {
    rootRef,
    view: issuesView(issues, list.error),
    error: list.error,
    refresh: list.refresh,
    issues,
    visible,
    columns,
    labels,
    scope,
    setScope,
    layout,
    setLayout,
    selected,
    select: setSelectedId,
    closeSheet,
    createOpen,
    createStatus,
    openCreate,
    closeCreate,
    create,
    actions,
    drag,
    viewRun,
  };
}

export type IssuesTabState = ReturnType<typeof useIssuesTab>;
