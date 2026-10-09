import { useCallback, useMemo } from "react";
import { CONTAINERS_URLS } from "../../../features/containers/constants";
import { useBuildImage } from "../../../features/containers/hooks/use-build-image";
import { useContainersReport } from "../../../features/containers/hooks/use-containers-report";
import { useOpenExternal } from "../../../features/containers/hooks/use-open-external";
import { checkViews, type InlineAction } from "./model";

export function useContainersChecks() {
  const { report, checking, refresh } = useContainersReport();
  const build = useBuildImage();
  const open = useOpenExternal();
  const { start } = build;
  const rows = useMemo(() => checkViews(report?.checks ?? [], build.step, build.building), [build.building, build.step, report]);
  const run = useCallback(
    (action: InlineAction) => {
      if (action === "build-image") start();
      else open(CONTAINERS_URLS.sysboxInstall);
    },
    [open, start],
  );
  return { rows, loading: report === null, checking, refresh, run, build };
}
