import { useMemo, useState } from "react";

import type { StatItem } from "@/components/stat-grid";
import { homeStats } from "@/features/home/utils/stats";
import {
  USAGE_RANGES,
  activeProjectIds,
  latestDay,
  runningAgentCount,
  type UsageRange,
} from "@/features/home/utils/usage";
import { useAgentRuns, useProcesses, useProjects, useTerminals } from "@/features/sandbox/hooks/use-sandbox-queries";
import { describeError } from "@/features/sandbox/utils/errors";

import { usageHeroData } from "../utils/overview";
import { useUsageReport } from "./use-analytics-queries";

export function useAnalyticsOverview() {
  const [range, setRange] = useState<UsageRange>(USAGE_RANGES[0]);
  const usage = useUsageReport(range);
  const projects = useProjects();
  const processes = useProcesses();
  const runs = useAgentRuns();
  const terminals = useTerminals();

  const report = usage.data;

  const stats = useMemo<StatItem[]>(() => {
    const today = latestDay(report);
    const active = activeProjectIds(processes.data ?? [], runs.data ?? [], terminals.data ?? []);
    return homeStats({
      activeProjects: active.size,
      totalProjects: projects.data?.length ?? 0,
      runningAgents: runningAgentCount(runs.data ?? []),
      sessionsToday: today.sessions,
      tokensToday: today.tokens,
      messagesToday: today.messages,
    });
  }, [report, processes.data, runs.data, terminals.data, projects.data]);

  const data = useMemo(() => usageHeroData(report), [report]);

  return {
    stats,
    usage: {
      range,
      ranges: USAGE_RANGES,
      setRange,
      data,
      loading: usage.isLoading,
      error: usage.error ? describeError(usage.error) : null,
      retry: () => void usage.refetch(),
    },
  };
}
