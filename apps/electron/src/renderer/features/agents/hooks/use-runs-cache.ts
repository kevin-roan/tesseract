import { useQueryClient } from "@tanstack/react-query";
import type { AgentRun } from "@theone/protocol";
import { useMemo } from "react";
import { DATA_KEYS, useApiClient } from "../../../app/data";
import { AGENTS_QUERY_KEYS } from "../constants";
import { removeRuns, stripEvents, upsertRun } from "../model";

export interface RunsCache {
  upsert(run: AgentRun): void;
  remove(ids: readonly string[]): void;
  find(id: string): AgentRun | null;
  refresh(): void;
  refreshArchived(): void;
}

export function useRunsCache(): RunsCache {
  const queryClient = useQueryClient();
  const baseUrl = useApiClient()?.baseUrl ?? "none";
  return useMemo(() => {
    const runsKey = DATA_KEYS.api(baseUrl, ...AGENTS_QUERY_KEYS.runs);
    const archivedKey = DATA_KEYS.api(baseUrl, ...AGENTS_QUERY_KEYS.archived);
    const update = (key: readonly unknown[], fn: (runs: AgentRun[] | null) => AgentRun[] | null) =>
      queryClient.setQueryData<AgentRun[] | null>(key, (current) => (current === undefined ? current : fn(current)));
    return {
      upsert: (input) => {
        const run = stripEvents(input);
        if (run.archivedAt) {
          update(runsKey, (runs) => removeRuns(runs, [run.id]));
          update(archivedKey, (runs) => upsertRun(runs, run));
        } else {
          update(archivedKey, (runs) => removeRuns(runs, [run.id]));
          if (queryClient.getQueryData(runsKey) === undefined) queryClient.setQueryData(runsKey, [run]);
          else update(runsKey, (runs) => upsertRun(runs, run));
        }
      },
      remove: (ids) => {
        update(runsKey, (runs) => removeRuns(runs, ids));
        update(archivedKey, (runs) => removeRuns(runs, ids));
      },
      find: (id) =>
        [runsKey, archivedKey]
          .flatMap((key) => queryClient.getQueryData<AgentRun[]>(key) ?? [])
          .find((run) => run.id === id) ?? null,
      refresh: () => void queryClient.invalidateQueries({ queryKey: runsKey }),
      refreshArchived: () => void queryClient.invalidateQueries({ queryKey: archivedKey }),
    };
  }, [queryClient, baseUrl]);
}
