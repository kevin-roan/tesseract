import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { ServerContainer } from "../../../../shared/contracts/containers";
import { errorMessage, useFormState, useSubmitAction } from "../../../components/FormDialog";
import { showToast } from "../../../components/Toast";
import { ipc } from "../../../lib/ipc";
import { CONTAINERS_KEYS, type MemoryUnit } from "../constants";
import { CONTAINERS_LABELS as L } from "../labels";
import { createBlocker, createErrors, parseOptionalNumber, toMemoryMb, upsertContainer, type CreateValues } from "../model";
import { useBuildImage } from "./use-build-image";
import { useContainersPhase } from "./use-containers-phase";
import { useContainersReport } from "./use-containers-report";

const EMPTY: CreateValues = { name: "", cpus: "", memory: "" };
const DEFAULT_UNIT: MemoryUnit = "gb";

export function useCreateContainer(onCreated: (container: ServerContainer) => void, onClose: () => void) {
  const queryClient = useQueryClient();
  const fields = useFormState<keyof CreateValues>(EMPTY);
  const action = useSubmitAction();
  const [unit, setUnit] = useState<MemoryUnit>(DEFAULT_UNIT);
  const { report } = useContainersReport();
  const phase = useContainersPhase();
  const build = useBuildImage();
  const blocker = createBlocker(report);
  const creating = phase.kind === "creating" ? phase.name : null;
  const { reset: resetFields, fail, values } = fields;
  const { reset: resetAction, run } = action;

  const reset = useCallback(() => {
    resetFields();
    resetAction();
    setUnit(DEFAULT_UNIT);
  }, [resetAction, resetFields]);

  const submit = useCallback(async () => {
    if (blocker || action.busy) return;
    const errors = createErrors(values);
    if (Object.keys(errors).length > 0) {
      fail(errors);
      return;
    }
    const request = {
      name: values.name.trim().toLowerCase(),
      cpus: parseOptionalNumber(values.cpus) ?? null,
      memoryMb: toMemoryMb(parseOptionalNumber(values.memory) ?? null, unit),
    };
    await run(async () => {
      const container = await ipc.containers.create(request);
      queryClient.setQueryData<ServerContainer[]>(CONTAINERS_KEYS.list, (list) => upsertContainer(list, container));
      showToast(L.create.created(container.name));
      onCreated(container);
      onClose();
    }, (error) => L.create.failed(errorMessage(error)));
  }, [action.busy, blocker, fail, onClose, onCreated, queryClient, run, unit, values]);

  return {
    fields,
    unit,
    setUnit,
    busy: action.busy,
    error: action.error,
    creating: action.busy ? (creating ?? values.name.trim()) : null,
    blocker,
    tailscaleMissing: report !== null && !report.tailscaleKey,
    build,
    submit,
    reset,
  };
}
