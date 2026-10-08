import { useQueryClient } from "@tanstack/react-query";
import type { AgentRun, Project } from "@tesseract/protocol";
import { useCallback, useMemo } from "react";
import { useServerEvent } from "../../../app/connection";
import { DATA_KEYS, useApiClient, useApiQuery } from "../../../app/data";
import { removeById, upsertById } from "../model";
import { PROJECTS_QUERY_KEYS } from "../query-keys";

export interface WorkspaceActions {
  refresh(): void;
  upsertProject(project: Project): void;
  removeProject(id: string): void;
  knownIds(): string[];
}

export function useWorkspaceProjects() {
  const query = useApiQuery(PROJECTS_QUERY_KEYS.projects, (client, signal) => client.listProjects({ signal }));
  return { projects: query.data ?? null, error: query.error, fetching: query.isFetching };
}

export function useWorkspaceRuns(): AgentRun[] {
  const query = useApiQuery(PROJECTS_QUERY_KEYS.agentRuns, (client, signal) => client.listAgentRuns(undefined, { signal }));
  return query.data ?? EMPTY_RUNS;
}

const EMPTY_RUNS: AgentRun[] = [];

export function useWorkspaceActions(): WorkspaceActions {
  const queryClient = useQueryClient();
  const baseUrl = useApiClient()?.baseUrl ?? "none";
  const projectsKey = useMemo(() => DATA_KEYS.api(baseUrl, ...PROJECTS_QUERY_KEYS.projects), [baseUrl]);
  const runsKey = useMemo(() => DATA_KEYS.api(baseUrl, ...PROJECTS_QUERY_KEYS.agentRuns), [baseUrl]);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: projectsKey });
    void queryClient.invalidateQueries({ queryKey: runsKey });
  }, [queryClient, projectsKey, runsKey]);

  const upsertProject = useCallback(
    (project: Project) => queryClient.setQueryData<Project[]>(projectsKey, (current) => upsertById(current ?? [], project)),
    [queryClient, projectsKey],
  );

  const removeProject = useCallback(
    (id: string) => queryClient.setQueryData<Project[]>(projectsKey, (current) => (current ? removeById(current, id) : current)),
    [queryClient, projectsKey],
  );

  const knownIds = useCallback(() => (queryClient.getQueryData<Project[]>(projectsKey) ?? []).map((project) => project.id), [queryClient, projectsKey]);

  return useMemo(() => ({ refresh, upsertProject, removeProject, knownIds }), [refresh, upsertProject, removeProject, knownIds]);
}

export function useWorkspaceEvents(): void {
  const actions = useWorkspaceActions();
  useServerEvent("project.updated", (event) => actions.upsertProject(event.project));
  useServerEvent("project.deleted", (event) => actions.removeProject(event.id));
}
