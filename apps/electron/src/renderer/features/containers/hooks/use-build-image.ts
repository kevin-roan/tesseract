import { ipc } from "../../../lib/ipc";
import { CONTAINERS_LABELS as L } from "../labels";
import { useContainersTask } from "./use-containers-task";

export function useBuildImage() {
  return useContainersTask("building", () => ipc.containers.buildImage(), L.create.buildFailed);
}
