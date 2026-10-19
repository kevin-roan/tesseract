import { useMutation, useMutationState } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { describeError } from "../../../app/connection";
import { useApiClient } from "../../../app/data";
import { showToast } from "../../../components/Toast";
import { PROCESSES_MUTATIONS } from "../constants";
import { PROCESSES_LABELS as L } from "../labels";
import type { ProcessTarget, StopRequest } from "../types";
import type { HostDeviceKind } from "../../host-shell/types";
import type { HostDeviceList } from "./use-host-device-list";

export interface StopProcessOptions {
  host: Pick<HostDeviceList, "stop" | "refresh">;
  onSettled(): void;
}

export function stopKey(target: Pick<ProcessTarget, "group" | "id">): string {
  return `${target.group}:${target.id}`;
}

export function useStopProcess({ host, onSettled }: StopProcessOptions) {
  const client = useApiClient();
  const mutation = useMutation({
    mutationKey: PROCESSES_MUTATIONS.stop,
    mutationFn: async ({ target, signal }: StopRequest) => {
      if (target.group === "emulator") return host.stop(target.id as HostDeviceKind, signal);
      if (!client) throw new Error(L.notConnected);
      return client.stopRuntime(target.group, target.id, { signal });
    },
    onSuccess: (_result, { target, signal }) => showToast(signal === "SIGKILL" ? L.actions.killed(target.name) : L.actions.stopped(target.name)),
    onError: (error, { target }) => showToast(L.actions.failed(target.name, describeError(error))),
    onSettled: (_result, _error, { target }) => {
      if (target.group === "emulator") host.refresh();
      onSettled();
    },
  });
  const { mutate } = mutation;
  const stop = useCallback((target: ProcessTarget) => mutate({ target, signal: "SIGTERM" }), [mutate]);
  const kill = useCallback((target: ProcessTarget) => mutate({ target, signal: "SIGKILL" }), [mutate]);
  return { stop, kill };
}

export function usePendingStops(): ReadonlySet<string> {
  const keys = useMutationState({
    filters: { mutationKey: PROCESSES_MUTATIONS.stop, status: "pending" },
    select: (mutation) => {
      const variables = mutation.state.variables as StopRequest | undefined;
      return variables ? stopKey(variables.target) : null;
    },
  });
  const joined = keys.filter(Boolean).sort().join("\n");
  return useMemo(() => new Set(joined ? joined.split("\n") : []), [joined]);
}
