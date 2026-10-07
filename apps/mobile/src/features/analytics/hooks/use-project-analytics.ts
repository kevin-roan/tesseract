import { useMemo } from "react";

import { useSandboxClient } from "@/features/sandbox/hooks/use-sandbox-client";
import { useSandboxRefresh } from "@/features/sandbox/hooks/use-sandbox-refresh";
import { describeError } from "@/features/sandbox/utils/errors";
import { useProjectNames } from "@/features/sandbox/hooks/use-project-names";

import { buildProjectView } from "../utils/project-view";
import { projectLabel } from "../utils/view-model";
import { useAnalyticsNavigation } from "./use-analytics-navigation";
import { useClaudeSessions, useUsageReport } from "./use-analytics-queries";
import { useRange } from "./use-range";

export function useProjectAnalytics(projectId: string, initialDays?: string | string[]) {
  const { sandbox } = useSandboxClient();
  const range = useRange(initialDays);
  const nav = useAnalyticsNavigation();
  const report = useUsageReport(range.days);
  const sessions = useClaudeSessions(projectId);
  const names = useProjectNames();
  const { refreshing, refresh } = useSandboxRefresh();

  const view = useMemo(
    () => (report.data ? buildProjectView(projectId, report.data, sessions.data) : null),
    [projectId, report.data, sessions.data],
  );

  return {
    sandbox,
    nav,
    range,
    title: projectLabel(projectId, names),
    view,
    loading: report.isLoading,
    stale: report.isPlaceholderData,
    error: report.error ? describeError(report.error) : null,
    sessionsError: sessions.error ? describeError(sessions.error) : null,
    sessionsLoading: sessions.isLoading,
    retry: () => void report.refetch(),
    retrySessions: () => void sessions.refetch(),
    refreshing,
    refresh,
  };
}
