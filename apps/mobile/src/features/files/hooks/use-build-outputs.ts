import { useMemo, useState } from "react";

import { useBuildOutputs as useBuildOutputsQuery } from "@/features/sandbox/hooks/use-sandbox-queries";
import { describeError } from "@/features/sandbox/utils/errors";

import { buildOutputsSubtitle, filterBuildOutputs } from "../utils/build-outputs";
import { ALL_PROJECTS } from "../utils/constants";
import { projectFilterId, projectFilterOptions } from "../utils/filters";
import { useBuildOutputDownload } from "./use-file-download";

/** Deliverables builds left in project folders; fetched only while `enabled` (the Project builds view is open). */
export function useBuildOutputs(enabled: boolean, names: ReadonlyMap<string, string>) {
  const query = useBuildOutputsQuery(enabled);
  const downloads = useBuildOutputDownload();
  const [projectId, setProjectId] = useState<string | null>(null);
  const all = query.data;
  const outputs = useMemo(() => filterBuildOutputs(all ?? [], projectId), [all, projectId]);
  const projectOptions = useMemo(() => projectFilterOptions(all ?? [], names), [all, names]);

  return {
    outputs,
    total: all?.length ?? 0,
    subtitle: buildOutputsSubtitle(outputs.length, all?.length ?? 0),
    loading: query.isLoading,
    error: query.error ? describeError(query.error) : null,
    retry: () => void query.refetch(),
    projectOptions,
    projectId: projectId ?? ALL_PROJECTS,
    selectProject: (id: string) => setProjectId(projectFilterId(id)),
    clearFilters: () => setProjectId(null),
    download: downloads.download,
    share: downloads.share,
    localStatus: downloads.status,
    downloadError: downloads.error,
  };
}
