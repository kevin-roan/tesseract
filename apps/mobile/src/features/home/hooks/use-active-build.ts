import { useCallback, useMemo } from "react";

import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { useBuilds } from "@/features/sandbox/hooks/use-sandbox-queries";

import { activeBuilds, buildActivityMessage, buildActivityTitle } from "../utils/builds";

export function useActiveBuild() {
  const nav = useSandboxNavigation();
  const builds = useBuilds();

  const active = useMemo(() => activeBuilds(builds.data ?? []), [builds.data]);
  const current = active[0] ?? null;
  const currentId = current?.id ?? null;

  const view = useCallback(() => {
    if (currentId) nav.build(currentId);
  }, [nav, currentId]);

  return useMemo(
    () =>
      current
        ? {
            id: current.id,
            title: buildActivityTitle(current),
            message: buildActivityMessage(current, active.length - 1),
            progress: current.progress,
            view,
          }
        : null,
    [current, active.length, view],
  );
}
