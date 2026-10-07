import type { TheOneClient } from "@theone/client";
import type { AppRun, Artifact, BuildJob, ClaudeAccountList, ClaudeSession, GitDetails, ProcessInfo, Project, RunTargetInfo } from "@theone/protocol";
import { SESSION_LIMIT } from "./constants";
import { projectArtifacts, projectBuilds, projectProcesses } from "./model";

export interface DetailSnapshot {
  project: Project;
  processes: ProcessInfo[];
  builds: BuildJob[];
  artifacts: Artifact[];
  runTargets: RunTargetInfo[] | null;
  appRuns: AppRun[] | null;
  runTargetsError: unknown;
  sessions: ClaudeSession[];
  accounts: ClaudeAccountList | null;
  git: GitDetails | null;
  gitError: unknown;
}

async function settle<T>(promise: Promise<T>): Promise<{ value: T; error: null } | { value: null; error: unknown }> {
  try {
    return { value: await promise, error: null };
  } catch (error) {
    return { value: null, error };
  }
}

export async function fetchDetailSnapshot(client: TheOneClient, id: string, signal: AbortSignal): Promise<DetailSnapshot> {
  const options = { signal };
  const filter = { projectId: id };
  const projectRequest = client.getProject(id, options);
  const optional = Promise.all([
    settle(Promise.all([client.listRunTargets(id, options), client.listAppRuns(filter, options)])),
    settle(client.sessions({ limit: SESSION_LIMIT, projectId: id }, options)),
    settle(client.claudeAccounts(options)),
    settle(projectRequest.then((project) => (project.git ? client.getProjectGit(id, options) : null))),
  ]);
  const [project, processes, builds, artifacts] = await Promise.all([
    projectRequest,
    client.listProcesses(filter, options),
    client.listBuilds(filter, options),
    client.listArtifacts(filter, options),
  ]);
  const [targets, sessions, accounts, git] = await optional;
  return {
    project,
    processes: projectProcesses(processes, id),
    builds: projectBuilds(builds, id),
    artifacts: projectArtifacts(artifacts, id),
    runTargets: targets.value?.[0] ?? null,
    appRuns: targets.value?.[1] ?? null,
    runTargetsError: targets.error,
    sessions: sessions.value ?? [],
    accounts: accounts.value,
    git: git.value,
    gitError: git.error,
  };
}
