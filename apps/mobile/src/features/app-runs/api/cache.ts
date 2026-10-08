import type { QueryClient } from "@tanstack/react-query";
import type { AppRun } from "@tesseract/protocol";

import { filterFromKey, matchesFilter } from "@/features/sandbox/api/query-keys";
import { upsertById } from "@/features/sandbox/utils/collections";

import { appRunKeys } from "./query-keys";

export function storeAppRun(queryClient: QueryClient, sandboxId: string, run: AppRun): void {
  for (const [queryKey, data] of queryClient.getQueriesData<AppRun[]>({ queryKey: appRunKeys.lists(sandboxId) })) {
    if (!data || !matchesFilter(filterFromKey(queryKey), run.projectId)) continue;
    queryClient.setQueryData<AppRun[]>(queryKey, upsertById(data, run));
  }
  queryClient.setQueryData<AppRun>(appRunKeys.detail(sandboxId, run.id), (current) => (current ? run : current));
}

export function cachedAppRun(queryClient: QueryClient, sandboxId: string, runId: string): AppRun | undefined {
  for (const [, data] of queryClient.getQueriesData<AppRun[]>({ queryKey: appRunKeys.lists(sandboxId) })) {
    const run = data?.find((entry) => entry.id === runId);
    if (run) return run;
  }
  return undefined;
}
