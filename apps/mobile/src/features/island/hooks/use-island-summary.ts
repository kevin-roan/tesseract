import { useMemo } from "react";

import type { IslandState } from "@/modules/theone-island";

import { islandSummary } from "../utils/format";
import { useNow } from "./use-now";

/** What the island shows right now, ticking every second while a run's timer is on screen. */
export function useIslandSummary(state: Pick<IslandState, "runs" | "commands">, sharedCount: number, hasDraft: boolean) {
  const now = useNow(state.runs.length > 0);
  return useMemo(() => islandSummary(state, sharedCount, hasDraft, now), [state, sharedCount, hasDraft, now]);
}
