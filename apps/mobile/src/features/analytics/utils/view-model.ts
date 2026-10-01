import type { ClaudeSession, UsageByProject, UsageReport } from "@theone/protocol";

import type { BarItem, ChartBucket, Delta, HeatmapGrid } from "../types";
import { rankSessionsByTokens, sessionStartHeatmap, sessionsActiveSince } from "./activity";
import { formatCompact, formatCount, formatDelta, formatPercent, plural } from "./format";
import { cacheHitRate, comparisonDays, computeDelta, previousPeriod } from "./metrics";
import { bucketSizeFor, sessionBuckets, tokenBuckets } from "./series";

export type Kpi = {
  id: string;
  label: string;
  value: string;
  caption: string;
};

export type Headline = {
  value: string;
  exact: string;
  delta: Delta | null;
  caption: string | null;
};

export type ProjectItem = Omit<BarItem, "onPress"> & { projectId: string | null };

export type AnalyticsView = {
  days: number;
  headline: Headline;
  kpis: Kpi[];
  tokenBuckets: ChartBucket[];
  bucketSize: number;
  sessionBuckets: ChartBucket[];
  models: BarItem[];
  projects: ProjectItem[];
  heatmap: HeatmapGrid;
  heatmapSample: number;
  topSessions: ClaudeSession[];
};

export const OUTSIDE_PROJECTS_LABEL = "Outside projects";

export function projectLabel(projectId: string | null, names: ReadonlyMap<string, string>): string {
  if (projectId === null) return OUTSIDE_PROJECTS_LABEL;
  return names.get(projectId) ?? projectId;
}

export function comparisonCaption(delta: Delta | null, days: number, loading: boolean): string | null {
  if (delta) return `${formatDelta(delta)} vs the previous ${days} days`;
  if (comparisonDays(days) === null) return `No comparison: history only goes back ${days} days`;
  return loading ? null : "No comparison available";
}

export function tokenMixDetail(usage: Pick<UsageByProject, "messages">, sessions?: number): string {
  const parts = [plural(usage.messages, "message")];
  if (sessions !== undefined) parts.push(plural(sessions, "session"));
  return parts.join(", ");
}

export function projectItems(report: UsageReport, names: ReadonlyMap<string, string>): ProjectItem[] {
  return report.projects.map((project) => ({
    id: project.projectId ?? "outside",
    projectId: project.projectId,
    label: projectLabel(project.projectId, names),
    value: project.totalTokens,
    valueLabel: formatCompact(project.totalTokens),
    detail: tokenMixDetail(project, project.sessions),
  }));
}

export type AnalyticsInput = {
  days: number;
  report: UsageReport;
  comparison?: UsageReport;
  comparisonLoading?: boolean;
  sessions?: readonly ClaudeSession[];
  projectNames?: ReadonlyMap<string, string>;
};

export function buildAnalyticsView({
  days,
  report,
  comparison,
  comparisonLoading = false,
  sessions = [],
  projectNames = new Map(),
}: AnalyticsInput): AnalyticsView {
  const { totals } = report;
  const previous = previousPeriod(comparison, days);
  const tokenDelta = computeDelta(totals.totalTokens, previous?.totalTokens ?? null);
  const messageDelta = computeDelta(totals.messages, previous?.messages ?? null);
  const bucketSize = bucketSizeFor(days);
  const inRange = sessionsActiveSince(sessions, report.from);

  return {
    days,
    headline: {
      value: formatCompact(totals.totalTokens),
      exact: `${formatCount(totals.totalTokens)} tokens`,
      delta: tokenDelta,
      caption: comparisonCaption(tokenDelta, days, comparisonLoading),
    },
    kpis: [
      {
        id: "messages",
        label: "Messages",
        value: formatCount(totals.messages),
        caption: messageDelta ? `${formatDelta(messageDelta)} vs previous` : "Replies from Claude",
      },
      { id: "sessions", label: "Sessions", value: formatCount(totals.sessions), caption: "With activity in range" },
      {
        id: "cache",
        label: "Cache hit rate",
        value: formatPercent(cacheHitRate(totals)),
        caption: "Prompt tokens read from cache",
      },
      { id: "output", label: "Output tokens", value: formatCompact(totals.outputTokens), caption: "Written by Claude" },
    ],
    tokenBuckets: tokenBuckets(report.daily, bucketSize),
    bucketSize,
    sessionBuckets: sessionBuckets(report.daily),
    models: report.models.map((model) => ({
      id: model.model,
      label: model.model,
      value: model.totalTokens,
      valueLabel: formatCompact(model.totalTokens),
      detail: plural(model.messages, "message"),
    })),
    projects: projectItems(report, projectNames),
    heatmap: sessionStartHeatmap(sessions, report.from),
    heatmapSample: sessions.length,
    topSessions: rankSessionsByTokens(inRange),
  };
}
