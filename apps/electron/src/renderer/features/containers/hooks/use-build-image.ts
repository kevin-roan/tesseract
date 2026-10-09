import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import { errorMessage } from "../../../components/FormDialog";
import { showToast } from "../../../components/Toast";
import { ipc } from "../../../lib/ipc";
import { CONTAINERS_LABELS as L } from "../labels";
import { buildStep } from "../model";
import { useContainersPhase } from "./use-containers-phase";
import { useSetReport } from "./use-containers-report";

export function useBuildImage() {
  const phase = useContainersPhase();
  const setReport = useSetReport();
  const build = useMutation({
    mutationFn: () => ipc.containers.buildImage(),
    onSuccess: setReport,
    onError: (error) => showToast(L.create.buildFailed(errorMessage(error))),
  });
  const cancel = useMutation({ mutationFn: () => ipc.containers.cancel() });
  const { mutate: buildMutate } = build;
  const { mutate: cancelMutate } = cancel;
  const step = buildStep(phase);
  return {
    building: build.isPending || phase.kind === "building",
    step,
    start: useCallback(() => buildMutate(), [buildMutate]),
    cancel: useCallback(() => cancelMutate(), [cancelMutate]),
    cancelling: cancel.isPending,
  };
}

export type BuildImage = ReturnType<typeof useBuildImage>;
