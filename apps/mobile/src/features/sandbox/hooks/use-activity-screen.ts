import { useCallback, useMemo } from "react";

import type { ActivityItemProps } from "@/components/activity-item";

import type { ActivityRef } from "../types";
import { describeError } from "../utils/errors";
import { activityActor, activityFeed } from "../utils/profile";
import { useSandboxClient } from "./use-sandbox-client";
import { useSandboxNavigation } from "./use-sandbox-navigation";
import { useSandboxProblems } from "./use-sandbox-problems";
import {
  useAgentRuns,
  useBuilds,
  useProcesses,
  useProjects,
  useSandboxIdentity,
  useSandboxStatus,
} from "./use-sandbox-queries";
import { useSandboxRefresh } from "./use-sandbox-refresh";

export type ActivityFeedItem = ActivityItemProps & { id: string };

export function useActivityScreen() {
  const nav = useSandboxNavigation();
  const { sandbox } = useSandboxClient();
  const identity = useSandboxIdentity();
  const status = useSandboxStatus();
  const projects = useProjects();
  const processes = useProcesses();
  const builds = useBuilds();
  const runs = useAgentRuns();
  const problems = useSandboxProblems(status.error);
  const { refreshing, refresh } = useSandboxRefresh();

  const open = useCallback(
    (ref: ActivityRef): (() => void) | undefined => {
      switch (ref.kind) {
        case "build":
          return () => nav.build(ref.id);
        case "run":
          return () => nav.agentRun(ref.id);
        case "process": {
          const { projectId } = ref;
          return projectId ? () => nav.project(projectId, ref.id) : undefined;
        }
      }
    },
    [nav],
  );

  const items = useMemo<ActivityFeedItem[]>(() => {
    if (!sandbox) return [];
    const actor = activityActor(identity.data, sandbox);
    return activityFeed(
      { builds: builds.data, runs: runs.data, processes: processes.data, projects: projects.data },
      actor,
    ).map(({ id, ref, item }) => ({ ...item, id, testID: `activity-${id}`, onPress: open(ref) }));
  }, [sandbox, identity.data, builds.data, runs.data, processes.data, projects.data, open]);

  const feedError = builds.error ?? runs.error ?? processes.error;

  const retry = useCallback(() => {
    void builds.refetch();
    void runs.refetch();
    void processes.refetch();
  }, [builds, runs, processes]);

  return {
    back: nav.back,
    items,
    loading: builds.isLoading || runs.isLoading || processes.isLoading,
    error: feedError && !problems.issue && !problems.error ? describeError(feedError) : null,
    retry,
    askClaude: () => nav.newAgentRun(),
    refreshing,
    refresh,
  };
}
