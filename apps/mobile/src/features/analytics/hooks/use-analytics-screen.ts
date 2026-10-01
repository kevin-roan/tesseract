import { useCallback, useMemo } from "react";

import { useSandboxClient } from "@/features/sandbox/hooks/use-sandbox-client";
import { useSandboxRefresh } from "@/features/sandbox/hooks/use-sandbox-refresh";
import { describeError } from "@/features/sandbox/utils/errors";

import { comparisonDays, hasUsage } from "../utils/metrics";
import { buildAnalyticsView } from "../utils/view-model";
import { useAnalyticsNavigation } from "./use-analytics-navigation";
import { useClaudeSessions, useUsageReport } from "./use-analytics-queries";
import { useProjectNames } from "./use-project-names";
import { useRange } from "./use-range";

export function useAnalyticsScreen() {
  const { sandbox } = useSandboxClient();
  const range = useRange();
  const nav = useAnalyticsNavigation();
  const report = useUsageReport(range.days);
  const comparison = useUsageReport(comparisonDays(range.days));
  const sessions = useClaudeSessions();
  const projectNames = useProjectNames();
  const { refreshing, refresh } = useSandboxRefresh();

  const data = report.data;
  const stale = report.isPlaceholderData || (data !== undefined && data.days !== range.days);

  const view = useMemo(
    () =>
      data
        ? buildAnalyticsView({
            days: data.days,
            report: data,
            comparison: comparison.isPlaceholderData ? undefined : comparison.data,
            comparisonLoading: comparison.isFetching,
            sessions: sessions.data,
            projectNames,
          })
        : null,
    [data, comparison.data, comparison.isPlaceholderData, comparison.isFetching, sessions.data, projectNames],
  );

  const openProject = useCallback((projectId: string) => nav.project(projectId, range.days), [nav, range.days]);

  return {
    sandbox,
    openProject,
    nav,
    range,
    view,
    loading: report.isLoading,
    stale,
    empty: data !== undefined && !stale && !hasUsage(data),
    error: report.error ? describeError(report.error) : null,
    sessionsError: sessions.error ? describeError(sessions.error) : null,
    sessionsLoading: sessions.isLoading,
    retry: () => void report.refetch(),
    retrySessions: () => void sessions.refetch(),
    refreshing,
    refresh,
  };
}
