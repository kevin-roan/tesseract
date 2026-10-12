import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ContainersReport } from "../../../../shared/contracts/containers";
import { errorMessage } from "../../../components/FormDialog";
import { showToast } from "../../../components/Toast";
import { ipc } from "../../../lib/ipc";
import { phaseStep } from "../model";
import type { ContainersTaskPhase } from "../types";
import { useContainersPhase } from "./use-containers-phase";
import { useSetReport } from "./use-containers-report";

export function useContainersTask(kind: ContainersTaskPhase, run: () => Promise<ContainersReport>, failed: (error: string) => string) {
  const phase = useContainersPhase();
  const setReport = useSetReport();
  const task = useMutation({
    mutationFn: run,
    onSuccess: setReport,
    onError: (error) => showToast(failed(errorMessage(error))),
  });
  const cancel = useMutation({ mutationFn: () => ipc.containers.cancel() });
  const { mutate: taskMutate } = task;
  const { mutate: cancelMutate } = cancel;
  return {
    running: task.isPending || phase.kind === kind,
    step: phaseStep(phase, kind),
    start: useCallback(() => taskMutate(), [taskMutate]),
    cancel: useCallback(() => cancelMutate(), [cancelMutate]),
    cancelling: cancel.isPending,
  };
}

export type ContainersTask = ReturnType<typeof useContainersTask>;
