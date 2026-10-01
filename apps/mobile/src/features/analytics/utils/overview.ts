import type { UsageReport } from "@theone/protocol";

import type { UsageHeroData } from "@/features/home/components/usage-hero";
import { cachedPercent, tokenSplit } from "@/features/home/utils/tokens";
import { dailyTotals, hasUsage } from "@/features/home/utils/usage";

export function usageHeroData(report: UsageReport | undefined): UsageHeroData | null {
  if (!report) return null;
  return {
    totalTokens: report.totals.totalTokens,
    split: tokenSplit(report.totals),
    daily: dailyTotals(report),
    messages: report.totals.messages,
    sessions: report.totals.sessions,
    empty: !hasUsage(report),
    cachedPercent: cachedPercent(report.totals),
  };
}
