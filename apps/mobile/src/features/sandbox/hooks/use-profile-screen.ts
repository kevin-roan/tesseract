import { useCallback, useMemo } from "react";
import { isApiError } from "@theone/client";

import type { ActivityItemProps } from "@/components/activity-item";
import { useClaudeAccountEntry } from "@/features/claude-account/hooks/use-claude-account-entry";

import type { ActivityRef } from "../types";
import { describeError } from "../utils/errors";
import { activityActor, activityFeed, isTailscaleIdentityMissing, profileStats, profileView } from "../utils/profile";
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

export type ProfileActivityItem = ActivityItemProps & { id: string };

export function useProfileScreen() {
  const nav = useSandboxNavigation();
  const { sandbox, hydrated } = useSandboxClient();
  const identity = useSandboxIdentity();
  const status = useSandboxStatus();
  const projects = useProjects();
  const processes = useProcesses();
  const builds = useBuilds();
  const runs = useAgentRuns();
  const claude = useClaudeAccountEntry();
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

  const activity = useMemo<ProfileActivityItem[]>(() => {
    if (!sandbox) return [];
    const actor = activityActor(identity.data, sandbox);
    return activityFeed(
      { builds: builds.data, runs: runs.data, processes: processes.data, projects: projects.data },
      actor,
    ).map(({ id, ref, item }) => ({ ...item, id, testID: `activity-${id}`, onPress: open(ref) }));
  }, [sandbox, identity.data, builds.data, runs.data, processes.data, projects.data, open]);

  const identityNotFound = isApiError(identity.error, "not_found");
  const feedError = builds.error ?? runs.error ?? processes.error;

  const retryActivity = useCallback(() => {
    void builds.refetch();
    void runs.refetch();
    void processes.refetch();
  }, [builds, runs, processes]);

  return {
    nav,
    hydrated,
    sandbox,
    profile: sandbox ? profileView(identity.data, sandbox, status.data) : null,
    stats: profileStats(status.data),
    openSettings: nav.settings,
    tailscaleMissing: isTailscaleIdentityMissing(identity.data) || identityNotFound,
    identityError: identity.error && !identityNotFound && !problems.issue ? describeError(identity.error) : null,
    retryIdentity: () => void identity.refetch(),
    missingToken: problems.missingToken,
    issue: problems.issue,
    repair: problems.repair,
    statusError: problems.error,
    retryStatus: () => void status.refetch(),
    claudeAccountTitle: claude.title,
    claudeAccount: claude.subtitle,
    openClaudeAccount: claude.open,
    activity,
    activityLoading: builds.isLoading || runs.isLoading || processes.isLoading,
    activityError: feedError && !problems.issue && !problems.error ? describeError(feedError) : null,
    retryActivity,
    refreshing,
    refresh,
  };
}
