import { useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { DomainRoute, ServerContainer } from "../../../../shared/contracts/containers";
import { errorMessage } from "../../../components/FormDialog";
import { showToast } from "../../../components/Toast";
import { ipc } from "../../../lib/ipc";
import { CONTAINERS_KEYS, CONTAINERS_MUTATIONS } from "../constants";
import { CONTAINERS_LABELS as L } from "../labels";
import { upsertContainer, withoutContainer, withoutRoutes } from "../model";
import type { ContainerAction } from "../types";

interface ActionRequest {
  action: ContainerAction;
  name: string;
}

function runAction({ action, name }: ActionRequest): Promise<ServerContainer> {
  switch (action) {
    case "start":
      return ipc.containers.start(name);
    case "stop":
      return ipc.containers.stop(name);
    default:
      return ipc.containers.restart(name);
  }
}

export function useContainerActions() {
  const queryClient = useQueryClient();
  const action = useMutation({
    mutationKey: CONTAINERS_MUTATIONS.action,
    mutationFn: runAction,
    onSuccess: (container, request) => {
      queryClient.setQueryData<ServerContainer[]>(CONTAINERS_KEYS.list, (list) => upsertContainer(list, container));
      showToast(L.actions.done[request.action](request.name));
    },
    onError: (error, request) => showToast(L.actions.failed(request.action, request.name, errorMessage(error))),
  });
  const removal = useMutation({
    mutationKey: CONTAINERS_MUTATIONS.remove,
    mutationFn: (name: string) => ipc.containers.remove(name),
    onSuccess: (_result, name) => {
      queryClient.setQueryData<ServerContainer[]>(CONTAINERS_KEYS.list, (list) => withoutContainer(list, name));
      queryClient.setQueryData<DomainRoute[]>(CONTAINERS_KEYS.routes, (routes) => withoutRoutes(routes, (route) => route.container !== name));
      queryClient.removeQueries({ queryKey: CONTAINERS_KEYS.logs(name) });
      showToast(L.actions.deleted(name));
    },
    onError: (error, name) => showToast(L.actions.deleteFailed(name, errorMessage(error))),
  });
  const { mutate } = action;
  const { mutate: removeMutate } = removal;
  const run = useCallback((kind: ContainerAction, name: string) => mutate({ action: kind, name }), [mutate]);
  const start = useCallback((name: string) => run("start", name), [run]);
  const stop = useCallback((name: string) => run("stop", name), [run]);
  const restart = useCallback((name: string) => run("restart", name), [run]);
  const remove = useCallback((name: string, onRemoved?: () => void) => removeMutate(name, { onSuccess: onRemoved }), [removeMutate]);
  return { run, start, stop, restart, remove };
}

function pendingName(variables: unknown): string | null {
  if (typeof variables === "string") return variables;
  if (variables && typeof variables === "object" && "name" in variables && typeof variables.name === "string") return variables.name;
  return null;
}

export function usePendingContainers(): ReadonlySet<string> {
  const names = useMutationState({
    filters: { mutationKey: CONTAINERS_MUTATIONS.all, status: "pending" },
    select: (mutation) => pendingName(mutation.state.variables),
  });
  const key = names.filter(Boolean).sort().join("\n");
  return useMemo(() => new Set(key ? key.split("\n") : []), [key]);
}
