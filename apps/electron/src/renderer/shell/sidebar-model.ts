import type { AgentRun, Project } from "@theone/protocol";
import { runTitle, runTone, workspaceState, type SidebarProjectItem, type SidebarProjectsState } from "../components/Sidebar";
import { formatRelativeTime } from "../features/agents/format";
import { projectBadge, projectBadges } from "../features/agents/tints";
import { SIDEBAR_MODEL } from "./constants";
import { SHELL_LABELS } from "./labels";

function timestamp(iso: string | null | undefined): number {
  const value = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(value) ? 0 : value;
}

function runActivity(run: AgentRun): number {
  return Math.max(timestamp(run.endedAt), timestamp(run.startedAt));
}

function compareRuns(a: AgentRun, b: AgentRun): number {
  const running = Number(b.state === "running") - Number(a.state === "running");
  return running || runActivity(b) - runActivity(a);
}

interface Bucket {
  id: string | null;
  name: string;
  tint: number | null;
  confidential: boolean;
  runs: AgentRun[];
  activity: number;
}

export function sidebarProjectItems(
  projects: readonly Project[],
  runs: readonly AgentRun[],
  nowSeconds: number,
  unassignedName: string = SHELL_LABELS.noProject,
): SidebarProjectItem[] {
  const badges = projectBadges(projects);
  const buckets = new Map<string | null, Bucket>();
  for (const project of projects) {
    buckets.set(project.id, {
      id: project.id,
      name: project.name || project.id,
      tint: projectBadge(project.id, badges).tint,
      confidential: project.confidential,
      runs: [],
      activity: timestamp(project.git?.lastCommit?.date),
    });
  }
  for (const run of runs) {
    if (run.archivedAt) continue;
    const key = run.projectId && buckets.has(run.projectId) ? run.projectId : null;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { id: null, name: unassignedName, tint: null, confidential: false, runs: [], activity: 0 };
      buckets.set(null, bucket);
    }
    bucket.runs.push(run);
    bucket.activity = Math.max(bucket.activity, runActivity(run));
  }
  return [...buckets.values()]
    .map((bucket) => ({ bucket, running: bucket.runs.filter((run) => run.state === "running").length }))
    .sort(
      (a, b) =>
        Number(a.bucket.id === null) - Number(b.bucket.id === null) ||
        b.running - a.running ||
        b.bucket.activity - a.bucket.activity ||
        a.bucket.name.localeCompare(b.bucket.name, undefined, { sensitivity: "base" }),
    )
    .map(({ bucket, running }) => ({
      id: bucket.id,
      name: bucket.name,
      tint: bucket.tint,
      confidential: bucket.confidential,
      running,
      runs: [...bucket.runs]
        .sort(compareRuns)
        .slice(0, SIDEBAR_MODEL.runsPerProject)
        .map((run) => ({
          id: run.id,
          title: runTitle(run.prompt, SHELL_LABELS.untitledRun),
          tone: runTone(run.state),
          running: run.state === "running",
          time: formatRelativeTime(run.startedAt, nowSeconds),
        })),
    }));
}

export function sidebarProjectsState(online: boolean, projects: readonly Project[] | null, itemCount: number): SidebarProjectsState {
  return workspaceState(online, projects !== null, itemCount);
}

export function agentsBadge(runs: readonly AgentRun[], attention: number): number {
  return runs.filter((run) => run.state === "running").length + attention;
}
