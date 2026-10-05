import {
  isFinalAgentRunState,
  isFinalBuildState,
  isFinalProcessState,
  type AgentRun,
  type BuildJob,
  type ProcessInfo,
  type Project,
  type UsageReport,
} from "@theone/protocol";

import { buildTargetLabel } from "@/features/sandbox/utils/labels";

import type { IslandCommand, IslandRun, IslandState, IslandUsage } from "@/modules/theone-island";

import { RUN_TITLE_MAX } from "./constants";

export type IslandSources = {
  sandbox: { id: string; name: string } | null;
  runs?: readonly AgentRun[];
  processes?: readonly ProcessInfo[];
  builds?: readonly BuildJob[];
  projects?: readonly Project[];
  usage?: UsageReport;
  now?: number;
};

export const EMPTY_USAGE: IslandUsage = { todayTokens: 0, weekTokens: 0, runsToday: 0, messagesToday: 0 };

export function runTitle(prompt: string, max: number = RUN_TITLE_MAX): string {
  const line = prompt.split(/\r?\n/).find((candidate) => candidate.trim().length > 0)?.trim() ?? "";
  if (!line) return "Claude run";
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

export function projectNameOf(projectId: string | null, projects: readonly Project[] = []): string | null {
  if (!projectId) return null;
  return projects.find((project) => project.id === projectId)?.name ?? projectId;
}

export function islandUsage(report: UsageReport | undefined): IslandUsage {
  if (!report) return EMPTY_USAGE;
  const today = report.daily[report.daily.length - 1];
  return {
    todayTokens: today?.totalTokens ?? 0,
    weekTokens: report.totals.totalTokens,
    runsToday: today?.sessions ?? 0,
    messagesToday: today?.messages ?? 0,
  };
}

export function islandRuns(runs: readonly AgentRun[] = [], projects: readonly Project[] = []): IslandRun[] {
  return runs
    .filter((run) => !isFinalAgentRunState(run.state))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((run) => ({
      id: run.id,
      title: runTitle(run.prompt),
      project: projectNameOf(run.projectId, projects),
      state: "running",
      startedAt: run.startedAt,
      tokens: run.usage?.totalTokens ?? null,
    }));
}

export function islandCommands(
  processes: readonly ProcessInfo[] = [],
  builds: readonly BuildJob[] = [],
  projects: readonly Project[] = [],
): IslandCommand[] {
  const active: IslandCommand[] = [
    ...builds
      .filter((build) => !isFinalBuildState(build.state))
      .map((build) => ({
        id: build.id,
        label: `Build ${buildTargetLabel(build.target)}`,
        project: projectNameOf(build.projectId, projects),
        state: build.state,
      })),
    ...processes
      .filter((process) => !isFinalProcessState(process.state))
      .map((process) => ({
        id: process.id,
        label: process.name,
        project: projectNameOf(process.projectId, projects),
        state: process.state,
      })),
  ];
  return active;
}

export function islandState({ sandbox, runs, processes, builds, projects, usage, now = Date.now() }: IslandSources): IslandState {
  return {
    sandboxId: sandbox?.id ?? "",
    sandboxName: sandbox?.name ?? "Sandbox",
    runs: islandRuns(runs, projects),
    commands: islandCommands(processes, builds, projects),
    usage: islandUsage(usage),
    updatedAt: new Date(now).toISOString(),
  };
}

export const hasLiveWork = (state: IslandState): boolean => state.runs.length > 0 || state.commands.length > 0;

export const liveCount = (state: Pick<IslandState, "runs" | "commands">): number => state.runs.length + state.commands.length;

/** Everything but the timestamp, so a state is only "changed" when the activity would show something new. */
export function stateSignature(state: IslandState): string {
  const { updatedAt: _updatedAt, ...rest } = state;
  return JSON.stringify(rest);
}

export function isBuildCommand(id: string, builds: readonly BuildJob[] = []): boolean {
  return builds.some((build) => build.id === id);
}
