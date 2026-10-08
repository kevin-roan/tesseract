import type { AgentRun, Project } from "@tesseract/protocol";
import { useEffect, useMemo, useRef } from "react";
import { describeError, useWindowVisible } from "../../../app/connection";
import { useApiQuery } from "../../../app/data";
import { showToast } from "../../../components/Toast";
import { AGENTS_QUERY_KEYS, RUNS_HIDDEN_INTERVAL_MS, RUNS_INTERVAL_MS } from "../constants";
import { formatLabel, MANAGE_LABELS } from "../labels";
import { projectNames, sortRecent } from "../model";
import { projectBadges } from "../tints";

const EMPTY_RUNS: AgentRun[] = [];

export function useAgentRuns() {
  const visible = useWindowVisible();
  const query = useApiQuery(AGENTS_QUERY_KEYS.runs, (client, signal) => client.listAgentRuns(undefined, { signal }), {
    refetchInterval: visible ? RUNS_INTERVAL_MS : RUNS_HIDDEN_INTERVAL_MS,
  });
  const runs = useMemo(() => (query.data ? sortRecent(query.data) : null), [query.data]);
  return { runs, error: query.error, refetch: query.refetch };
}

export function useArchivedRuns(enabled: boolean, reportErrors = false) {
  const query = useApiQuery(AGENTS_QUERY_KEYS.archived, (client, signal) => client.listAgentRuns({ archived: true }, { signal }), {
    enabled,
    staleTime: 0,
  });
  const reported = useRef<unknown>(null);
  useEffect(() => {
    if (!enabled || !reportErrors || !query.error || reported.current === query.error) return;
    reported.current = query.error;
    showToast(formatLabel(MANAGE_LABELS.loadFailed, { error: describeError(query.error) }));
  }, [enabled, reportErrors, query.error]);
  const runs = useMemo(() => {
    if (query.data) return sortRecent(query.data);
    return query.isError ? EMPTY_RUNS : null;
  }, [query.data, query.isError]);
  return { runs, refetch: query.refetch };
}

export function useAgentProjects() {
  const query = useApiQuery(AGENTS_QUERY_KEYS.projects, (client, signal) => client.listProjects({ signal }));
  const projects: Project[] = query.data ?? [];
  const names = useMemo(() => projectNames(query.data), [query.data]);
  const badges = useMemo(() => projectBadges(query.data), [query.data]);
  return { projects, names, badges };
}
