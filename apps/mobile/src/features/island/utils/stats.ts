import { formatCount, formatTokens } from "@/features/home/utils/tokens";

import type { IslandUsage } from "@/modules/theone-island";

import type { IslandStat } from "../components/island-stats";

export function islandStats(usage: IslandUsage): IslandStat[] {
  return [
    { id: "today", value: formatTokens(usage.todayTokens), label: "Today" },
    { id: "week", value: formatTokens(usage.weekTokens), label: "7 days" },
    { id: "runs", value: formatCount(usage.runsToday), label: "Runs today" },
  ];
}
