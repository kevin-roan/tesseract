import { isFinalBuildState, type BuildJob, type ProcessInfo } from "@theone/protocol";
import { isLiveProcess } from "../projects/model";

export interface RunningWork {
  processes: ProcessInfo[];
  builds: BuildJob[];
}

const newest = (a: string | null | undefined, b: string | null | undefined) => (b ?? "").localeCompare(a ?? "");

export function runningWork(projectId: string | null | undefined, processes: readonly ProcessInfo[], builds: readonly BuildJob[]): RunningWork {
  if (!projectId) return { processes: [], builds: [] };
  return {
    processes: processes
      .filter((process) => process.projectId === projectId && isLiveProcess(process))
      .sort((a, b) => newest(a.startedAt, b.startedAt)),
    builds: builds
      .filter((build) => build.projectId === projectId && !isFinalBuildState(build.state))
      .sort((a, b) => newest(a.startedAt || a.createdAt, b.startedAt || b.createdAt)),
  };
}

export const runningCount = (work: RunningWork): number => work.processes.length + work.builds.length;
