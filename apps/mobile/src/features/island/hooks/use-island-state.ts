import { useMemo } from "react";

import { useUsage } from "@/features/home/hooks/use-usage";
import { useActiveSandbox } from "@/features/sandbox/hooks/use-sandbox-client";
import { useAgentRuns, useBuilds, useProcesses, useProjects } from "@/features/sandbox/hooks/use-sandbox-queries";

import type { IslandState } from "@/modules/tesseract-island";

import { USAGE_DAYS } from "../utils/constants";
import { islandState } from "../utils/state";

export function useIslandState(): IslandState {
  const sandbox = useActiveSandbox();
  const runs = useAgentRuns();
  const processes = useProcesses();
  const builds = useBuilds();
  const projects = useProjects();
  const usage = useUsage(USAGE_DAYS);

  return useMemo(
    () =>
      islandState({
        sandbox: sandbox ? { id: sandbox.id, name: sandbox.name } : null,
        runs: runs.data,
        processes: processes.data,
        builds: builds.data,
        projects: projects.data,
        usage: usage.data,
      }),
    [sandbox, runs.data, processes.data, builds.data, projects.data, usage.data],
  );
}
