import type { AgentRun, AppRun, Artifact, BuildJob, ClaudeAccountList, ClaudeSession, GitDetails, ProcessInfo, Project, RunTargetInfo } from "@theone/protocol";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { describeError, NotConfiguredError, useConnectionClient, usePoller, useServerEvent, useWindowVisible } from "../../../app/connection";
import { DETAIL_REFRESH_INTERVAL_MS } from "../constants";
import { fetchDetailSnapshot, type DetailSnapshot } from "../detail-snapshot";
import { projectArtifacts, projectBuilds, projectProcesses, removeById, upsertById } from "../model";
import type { ListKind, NoticeAction, ProjectNotice } from "../types";
import { useWorkspaceActions, useWorkspaceProjects, useWorkspaceRuns } from "./use-workspace";

export interface ProjectDetailState {
  project: Project | null;
  processes: ProcessInfo[] | null;
  builds: BuildJob[] | null;
  artifacts: Artifact[] | null;
  runTargets: RunTargetInfo[] | null;
  appRuns: AppRun[] | null;
  runTargetsError: unknown;
  sessions: ClaudeSession[] | null;
  accounts: ClaudeAccountList | null;
  git: GitDetails | null;
  gitError: unknown;
  loadError: unknown;
}

const INITIAL: Omit<ProjectDetailState, "project"> = {
  processes: null,
  builds: null,
  artifacts: null,
  runTargets: null,
  appRuns: null,
  runTargetsError: null,
  sessions: null,
  accounts: null,
  git: null,
  gitError: null,
  loadError: null,
};

const SORTERS = {
  processes: projectProcesses,
  builds: projectBuilds,
  artifacts: projectArtifacts,
} as const;

type ListItem<K extends ListKind> = K extends "processes" ? ProcessInfo : K extends "builds" ? BuildJob : Artifact;

function sameProject(a: Project | null, b: Project | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useProjectDetail(id: string) {
  const client = useConnectionClient();
  const visible = useWindowVisible();
  const workspace = useWorkspaceActions();
  const { projects } = useWorkspaceProjects();
  const runs = useWorkspaceRuns();
  const cached = projects?.find((project) => project.id === id) ?? null;

  const [state, setState] = useState<ProjectDetailState>(() => ({ ...INITIAL, project: cached }));
  const [notice, setNotice] = useState<ProjectNotice | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;

  const fetch = useCallback(
    (signal: AbortSignal): Promise<DetailSnapshot> => {
      if (!client) return Promise.reject(new NotConfiguredError());
      return fetchDetailSnapshot(client, id, signal);
    },
    [client, id],
  );

  const onResult = useCallback(
    (snapshot: DetailSnapshot) => {
      setState({ ...snapshot, loadError: null });
      workspace.upsertProject(snapshot.project);
      setNotice((current) => (current?.fromPoll ? null : current));
    },
    [workspace],
  );

  const onError = useCallback((error: unknown) => {
    if (stateRef.current.project) {
      setNotice({ message: describeError(error), fromPoll: true });
      return;
    }
    setState((current) => ({ ...current, loadError: error }));
  }, []);

  const poller = usePoller(fetch, DETAIL_REFRESH_INTERVAL_MS, { enabled: visible && client !== null, onResult, onError });
  const pollRefresh = poller.refresh;

  const upsert = useCallback(<K extends ListKind>(kind: K, item: ListItem<K>) => {
    setState((current) => {
      const list = current[kind] as ListItem<K>[] | null;
      if (!list) return current;
      const sorted = (SORTERS[kind] as unknown as (items: ListItem<K>[]) => ListItem<K>[])(upsertById(list, item));
      return { ...current, [kind]: sorted };
    });
  }, []);

  const remove = useCallback((kind: ListKind, itemId: string) => {
    setState((current) => {
      const list = current[kind] as { id: string }[] | null;
      return list ? { ...current, [kind]: removeById(list, itemId) } : current;
    });
  }, []);

  const report = useCallback((error: unknown, action?: NoticeAction) => {
    setNotice({ message: typeof error === "string" ? error : describeError(error), action, fromPoll: false });
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const setProject = useCallback(
    (project: Project) => {
      setState((current) => ({ ...current, project }));
      workspace.upsertProject(project);
    },
    [workspace],
  );

  const upsertAppRun = useCallback((run: AppRun) => {
    setState((current) => (current.appRuns ? { ...current, appRuns: upsertById(current.appRuns, run) } : current));
  }, []);

  const refresh = useCallback(() => {
    if (!stateRef.current.project) setState((current) => ({ ...current, loadError: null }));
    pollRefresh();
    workspace.refresh();
  }, [pollRefresh, workspace]);

  const mine = (projectId: string | null | undefined) => projectId === id;
  useServerEvent("process.updated", (event) => mine(event.process.projectId) && upsert("processes", event.process));
  useServerEvent("build.updated", (event) => mine(event.build.projectId) && upsert("builds", event.build));
  useServerEvent("artifact.created", (event) => mine(event.artifact.projectId) && upsert("artifacts", event.artifact));
  useServerEvent("artifact.deleted", (event) => remove("artifacts", event.id));
  useServerEvent("app.updated", (event) => mine(event.run.projectId) && upsertAppRun(event.run));

  useEffect(() => {
    const current = stateRef.current.project;
    if (!cached || sameProject(cached, current)) return;
    setState((previous) => ({ ...previous, project: cached }));
    if (current && JSON.stringify(current.git) !== JSON.stringify(cached.git)) pollRefresh();
  }, [cached, pollRefresh]);

  const knownRuns = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = new Set(runs.filter((run: AgentRun) => run.projectId === id).map((run) => run.id));
    const previous = knownRuns.current;
    knownRuns.current = ids;
    if (!previous || stateRef.current.sessions === null) return;
    for (const runId of ids) {
      if (!previous.has(runId)) {
        pollRefresh();
        return;
      }
    }
  }, [runs, id, pollRefresh]);

  const projectRuns = useMemo(() => runs.filter((run) => run.projectId === id), [runs, id]);

  return {
    state,
    runs: projectRuns,
    notice,
    loading: poller.loading,
    refresh,
    report,
    dismissNotice,
    upsert,
    remove,
    upsertAppRun,
    setProject,
    workspace,
  };
}

export type ProjectDetail = ReturnType<typeof useProjectDetail>;
