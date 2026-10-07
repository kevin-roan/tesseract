import { useMemo } from "react";
import { useInboxCounts, useIsOnline } from "../../app/connection";
import { useWorkspaceProjects, useWorkspaceRuns } from "../../features/projects/hooks/use-workspace";
import { nowSeconds } from "../../features/agents/format";
import { agentsBadge, sidebarProjectItems, sidebarProjectsState } from "../sidebar-model";

export function useSidebarProjects() {
  const online = useIsOnline();
  const { projects } = useWorkspaceProjects();
  const runs = useWorkspaceRuns();
  const inbox = useInboxCounts();
  const items = useMemo(() => sidebarProjectItems(projects ?? [], runs, nowSeconds()), [projects, runs]);
  return {
    online,
    items,
    projects: projects ?? [],
    state: sidebarProjectsState(online, projects, items.length),
    agentsCount: agentsBadge(runs, inbox.attentionCount),
  };
}
