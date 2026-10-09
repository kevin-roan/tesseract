import { Notice } from "../../../components/Notice";
import { CONTAINERS_URLS } from "../../../features/containers/constants";
import type { BuildImage } from "../../../features/containers/hooks/use-build-image";
import { useOpenExternal } from "../../../features/containers/hooks/use-open-external";
import { CONTAINERS_LABELS } from "../../../features/containers/labels";
import type { CreateBlocker } from "../../../features/containers/types";

export interface CreateBlockerNoticeProps {
  blocker: CreateBlocker | null;
  build: BuildImage;
  tailscaleMissing: boolean;
}

export function CreateBlockerNotice({ blocker, build, tailscaleMissing }: CreateBlockerNoticeProps) {
  const L = CONTAINERS_LABELS.create;
  const open = useOpenExternal();
  if (blocker === "sysbox") {
    return <Notice tone="warning" message={L.noSysbox} actionLabel={L.installSysbox} onAction={() => open(CONTAINERS_URLS.sysboxInstall)} />;
  }
  if (build.building) {
    return <Notice tone="info" title={L.building} message={build.step || L.noImage} actionLabel={L.cancelBuild} onAction={build.cancel} />;
  }
  if (blocker === "image") {
    return <Notice tone="warning" message={L.noImage} actionLabel={L.buildImage} onAction={build.start} />;
  }
  return tailscaleMissing ? <Notice tone="neutral" message={L.noTailscale} /> : null;
}
