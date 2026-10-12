import { Notice } from "../../../components/Notice";
import { CONTAINERS_URLS } from "../../../features/containers/constants";
import type { ContainersTask } from "../../../features/containers/hooks/use-containers-task";
import { useOpenExternal } from "../../../features/containers/hooks/use-open-external";
import { CONTAINERS_LABELS } from "../../../features/containers/labels";
import type { CreateBlocker } from "../../../features/containers/types";

export interface CreateBlockerNoticeProps {
  blocker: CreateBlocker | null;
  build: ContainersTask;
  vm: ContainersTask;
  tailscaleMissing: boolean;
}

export function CreateBlockerNotice({ blocker, build, vm, tailscaleMissing }: CreateBlockerNoticeProps) {
  const L = CONTAINERS_LABELS.create;
  const open = useOpenExternal();
  if (vm.running) {
    return <Notice tone="info" title={L.settingUpVm} message={vm.step || L.noVm} actionLabel={L.cancelSetup} onAction={vm.cancel} />;
  }
  if (blocker === "vm") {
    return <Notice tone="warning" message={L.noVm} actionLabel={L.setupVm} onAction={vm.start} />;
  }
  if (blocker === "sysbox") {
    return <Notice tone="warning" message={L.noSysbox} actionLabel={L.installSysbox} onAction={() => open(CONTAINERS_URLS.sysboxInstall)} />;
  }
  if (build.running) {
    return <Notice tone="info" title={L.building} message={build.step || L.noImage} actionLabel={L.cancelBuild} onAction={build.cancel} />;
  }
  if (blocker === "image") {
    return <Notice tone="warning" message={L.noImage} actionLabel={L.buildImage} onAction={build.start} />;
  }
  return tailscaleMissing ? <Notice tone="neutral" message={L.noTailscale} /> : null;
}
