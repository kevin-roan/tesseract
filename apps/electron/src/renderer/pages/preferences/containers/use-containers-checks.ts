import { useCallback, useMemo } from "react";
import { CONTAINERS_URLS } from "../../../features/containers/constants";
import { useBuildImage } from "../../../features/containers/hooks/use-build-image";
import { useContainersReport } from "../../../features/containers/hooks/use-containers-report";
import { useOpenExternal } from "../../../features/containers/hooks/use-open-external";
import { useSetupVm } from "../../../features/containers/hooks/use-setup-vm";
import { checkViews, runningTask, type InlineAction } from "./model";

export function useContainersChecks() {
  const { report, checking, refresh } = useContainersReport();
  const build = useBuildImage();
  const vm = useSetupVm();
  const open = useOpenExternal();
  const { start: startBuild } = build;
  const { start: startVm } = vm;
  const tasks = useMemo(
    () => ({ "build-image": { running: build.running, step: build.step }, "setup-vm": { running: vm.running, step: vm.step } }),
    [build.running, build.step, vm.running, vm.step],
  );
  const rows = useMemo(() => checkViews(report?.checks ?? [], tasks), [report, tasks]);
  const active = runningTask(tasks);
  const activeTask = active === "setup-vm" ? vm : active === "build-image" ? build : null;
  const run = useCallback(
    (action: InlineAction) => {
      if (action === "build-image") startBuild();
      else if (action === "setup-vm") startVm();
      else open(CONTAINERS_URLS.sysboxInstall);
    },
    [open, startBuild, startVm],
  );
  return {
    rows,
    loading: report === null,
    checking,
    refresh,
    run,
    active: active && activeTask ? { action: active, cancel: activeTask.cancel, cancelling: activeTask.cancelling } : null,
  };
}
