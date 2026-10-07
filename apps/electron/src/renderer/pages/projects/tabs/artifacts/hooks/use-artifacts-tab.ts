import type { Artifact } from "@theone/protocol";
import { useCallback, useMemo } from "react";
import { useFileActions } from "../../../../../features/files/hooks/use-file-actions";
import type { TabHost } from "../../../../../features/projects/hooks/use-tab-host";
import { projectArtifacts } from "../../../../../features/projects/model";

export interface ArtifactsTabInput {
  artifacts: readonly Artifact[] | null;
  host: TabHost;
}

export function useArtifactsTab({ artifacts: list, host }: ArtifactsTabInput) {
  const { remove, report } = host;
  const artifacts = useMemo(() => (list ? projectArtifacts(list) : null), [list]);
  const fail = useCallback((message: string) => report(new Error(message)), [report]);
  const onDeleted = useCallback((id: string) => remove("artifact", id), [remove]);
  const actions = useFileActions(fail, onDeleted);
  return { artifacts, actions };
}
