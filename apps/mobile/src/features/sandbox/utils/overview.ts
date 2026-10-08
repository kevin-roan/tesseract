import {
  isFinalAgentRunState,
  isFinalBuildState,
  type AgentRun,
  type BuildJob,
  type ProcessInfo,
  type Project,
} from "@theone/protocol";

import type { AvatarPerson } from "@/components/avatar-stack";
import { latestTurns } from "@/features/chat/utils/messages";

import type { ActiveWork, ProjectActivity, ProjectCardModel } from "../types";
import { newestFirst } from "./collections";
import { formatRelativeTime, pluralize, shortSha } from "./format";
import { buildTargetLabel, frameworkLabel } from "./labels";
import { isActiveProcess } from "./projects";
import { frameworkIcon, projectActivityIcon } from "./icons";
import { projectActivityLabel, projectActivityTone } from "./states";

const CLAUDE = "Claude";

export type WorkSources = {
  processes?: readonly ProcessInfo[];
  builds?: readonly BuildJob[];
  runs?: readonly AgentRun[];
};

export function activeWork({ processes = [], builds = [], runs = [] }: WorkSources): ActiveWork {
  return {
    processes: newestFirst(processes.filter(isActiveProcess), (process) => process.startedAt),
    builds: newestFirst(
      builds.filter((build) => !isFinalBuildState(build.state)),
      (build) => build.createdAt,
    ),
    runs: newestFirst(
      runs.filter((run) => !isFinalAgentRunState(run.state)),
      (run) => run.startedAt,
    ),
  };
}

export function finishedWork({ processes = [], builds = [], runs = [] }: WorkSources, limit?: number): ActiveWork {
  return {
    processes: newestFirst(
      processes.filter((process) => !isActiveProcess(process)),
      (process) => process.endedAt ?? process.startedAt,
      limit,
    ),
    builds: newestFirst(
      builds.filter((build) => isFinalBuildState(build.state)),
      (build) => build.endedAt ?? build.createdAt,
      limit,
    ),
    runs: newestFirst(
      latestTurns(runs).filter((run) => isFinalAgentRunState(run.state)),
      (run) => run.endedAt ?? run.startedAt,
      limit,
    ),
  };
}

export const activeWorkCount = (work: ActiveWork): number =>
  work.processes.length + work.builds.length + work.runs.length;

function workFor(work: ActiveWork, projectId: string): ActiveWork {
  return {
    processes: work.processes.filter((process) => process.projectId === projectId),
    builds: work.builds.filter((build) => build.projectId === projectId),
    runs: work.runs.filter((run) => run.projectId === projectId),
  };
}

export function projectActivity(
  work: ActiveWork,
  latestBuild: BuildJob | undefined,
  latestRun: AgentRun | undefined,
): ProjectActivity {
  if (work.builds.length > 0) return "building";
  if (work.runs.length > 0) return "agent";
  if (work.processes.length > 0) return "running";
  if (latestBuild?.state === "failed" || latestRun?.state === "failed") return "failed";
  return "idle";
}

function workMembers(work: ActiveWork): AvatarPerson[] {
  return [
    ...work.builds.map((build) => ({ id: build.id, name: buildTargetLabel(build.target) })),
    ...work.runs.map((run) => ({ id: run.id, name: CLAUDE })),
    ...work.processes.map((process) => ({ id: process.id, name: process.name })),
  ];
}

function lastCommitLine(project: Project, now: number): string | undefined {
  const commit = project.git?.lastCommit;
  if (!commit) return undefined;
  return [shortSha(commit.sha), commit.subject, formatRelativeTime(commit.date, now)].filter(Boolean).join(" · ");
}

export function projectCardModel(
  project: Project,
  all: ActiveWork,
  history: { builds?: readonly BuildJob[]; runs?: readonly AgentRun[] },
  now: number = Date.now(),
): ProjectCardModel {
  const work = workFor(all, project.id);
  const latestBuild = newestFirst(
    (history.builds ?? []).filter((build) => build.projectId === project.id),
    (build) => build.createdAt,
    1,
  )[0];
  const latestRun = newestFirst(
    (history.runs ?? []).filter((run) => run.projectId === project.id),
    (run) => run.startedAt,
    1,
  )[0];
  const activity = projectActivity(work, latestBuild, latestRun);
  const count = activeWorkCount(work);
  const git = project.git;

  return {
    id: project.id,
    title: project.name,
    subtitle: lastCommitLine(project, now),
    status: {
      caption: "Status",
      value: projectActivityLabel(activity),
      tone: projectActivityTone(activity),
      icon: projectActivityIcon(activity),
    },
    tag: {
      caption: "Framework",
      value: frameworkLabel(project.framework),
      tone: "info",
      icon: frameworkIcon(project.framework),
    },
    detail: {
      caption: "Branch",
      value: git ? `${git.branch ?? "detached"}${git.dirty ? " *" : ""}` : "No git",
    },
    members: workMembers(work),
    membersTitle: count > 0 ? pluralize(count, "active task") : "No active tasks",
    membersCaption: "in this project",
  };
}

export function projectCardModels(
  projects: readonly Project[],
  work: ActiveWork,
  history: { builds?: readonly BuildJob[]; runs?: readonly AgentRun[] },
  now: number = Date.now(),
): ProjectCardModel[] {
  return projects.map((project) => projectCardModel(project, work, history, now));
}
