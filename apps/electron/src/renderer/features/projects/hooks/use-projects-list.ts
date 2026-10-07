import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection } from "../../../app/connection";
import { listView } from "../list-view";
import type { ListTab } from "../types";
import { useActivityPoll } from "./use-activity-poll";
import { useWorkspaceActions, useWorkspaceEvents, useWorkspaceProjects, useWorkspaceRuns } from "./use-workspace";

export function useProjectsList() {
  const connection = useConnection();
  const { projects } = useWorkspaceProjects();
  const runs = useWorkspaceRuns();
  const activity = useActivityPoll();
  const workspace = useWorkspaceActions();
  useWorkspaceEvents();

  const [tab, setTab] = useState<ListTab>("all");
  const [grouped, setGrouped] = useState(false);
  const [query, setQuery] = useState("");

  const view = useMemo(
    () =>
      listView({
        projects,
        processes: activity.processes,
        builds: activity.builds,
        runs,
        status: connection.status,
        errorMessage: connection.errorMessage,
        query,
        tab,
        grouped,
        now: Date.now(),
      }),
    [projects, activity.processes, activity.builds, runs, connection.status, connection.errorMessage, query, tab, grouped],
  );

  const refreshActivity = activity.refresh;
  const refresh = useCallback(() => {
    workspace.refresh();
    refreshActivity();
  }, [workspace, refreshActivity]);

  useEffect(() => {
    workspace.refresh();
  }, [workspace]);

  const toggleGrouped = useCallback(() => setGrouped((value) => !value), []);

  return { view, tab, setTab, grouped, toggleGrouped, query, setQuery, refresh, workspace };
}
