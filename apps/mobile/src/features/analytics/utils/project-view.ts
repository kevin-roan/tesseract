import type { ClaudeSession, UsageReport } from "@theone/protocol";

import type { HeatmapGrid } from "../types";
import { rankSessionsByTokens, sessionStartHeatmap, sessionsActiveSince } from "./activity";
import { formatCompact, formatCount, formatPercent } from "./format";
import { cacheHitRate } from "./metrics";
import { tokenValues } from "./series";
import type { Kpi } from "./view-model";

export const PROJECT_SESSIONS_LIMIT = 50;

export type ProjectView = {
  hasUsage: boolean;
  kpis: Kpi[];
  tokenMix: number[];
  sessions: ClaudeSession[];
  heatmap: HeatmapGrid;
  heatmapSample: number;
};

export function buildProjectView(
  projectId: string,
  report: UsageReport,
  sessions: readonly ClaudeSession[] = [],
): ProjectView {
  const row = report.projects.find((project) => project.projectId === projectId);
  const own = sessions.filter((session) => session.projectId === projectId);
  const usage = row ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0 };
  const share = report.totals.totalTokens > 0 ? usage.totalTokens / report.totals.totalTokens : null;

  return {
    hasUsage: !!row && row.totalTokens > 0,
    kpis: [
      { id: "tokens", label: "Tokens", value: formatCompact(usage.totalTokens), caption: `${formatPercent(share)} of all usage` },
      { id: "messages", label: "Messages", value: formatCount(row?.messages ?? 0), caption: "Replies from Claude" },
      { id: "sessions", label: "Sessions", value: formatCount(row?.sessions ?? 0), caption: "With activity in range" },
      {
        id: "cache",
        label: "Cache hit rate",
        value: formatPercent(cacheHitRate(usage)),
        caption: "Prompt tokens read from cache",
      },
    ],
    tokenMix: tokenValues(usage),
    sessions: rankSessionsByTokens(sessionsActiveSince(own, report.from), PROJECT_SESSIONS_LIMIT),
    heatmap: sessionStartHeatmap(own, report.from),
    heatmapSample: own.length,
  };
}
