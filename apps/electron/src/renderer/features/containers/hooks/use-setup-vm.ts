import { ipc } from "../../../lib/ipc";
import { CONTAINERS_LABELS as L } from "../labels";
import { useContainersTask } from "./use-containers-task";

export function useSetupVm() {
  return useContainersTask("setting-up-vm", () => ipc.containers.setupVm(), L.create.setupVmFailed);
}
