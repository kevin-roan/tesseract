import { useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { HostDeploy, ServerContainer } from "../../../../shared/contracts/containers";
import { errorMessage } from "../../../components/FormDialog";
import { showToast } from "../../../components/Toast";
import { ipc } from "../../../lib/ipc";
import { CONTAINERS_KEYS, DEPLOYS_MUTATIONS } from "../constants";
import { DEPLOYS_LABELS as L } from "../labels";
import { approvedMessage, upsertContainer } from "../model";

type Decision = "approve" | "reject";

interface DecisionRequest {
  decision: Decision;
  deploy: HostDeploy;
}

interface AutoDeployRequest {
  name: string;
  enabled: boolean;
}

function decide({ decision, deploy }: DecisionRequest): Promise<void> {
  return decision === "approve" ? ipc.containers.approveDeploy(deploy.id) : ipc.containers.rejectDeploy(deploy.id);
}

export function useDeployActions() {
  const queryClient = useQueryClient();
  const invalidateDeploys = useCallback(() => queryClient.invalidateQueries({ queryKey: CONTAINERS_KEYS.deploys }), [queryClient]);
  const decision = useMutation({
    mutationKey: DEPLOYS_MUTATIONS.decide,
    mutationFn: decide,
    onSuccess: (_result, { decision: kind, deploy }) => showToast(kind === "approve" ? approvedMessage(deploy) : L.rejected(deploy.app)),
    onError: (error, { decision: kind, deploy }) =>
      showToast(kind === "approve" ? L.approveFailed(deploy.app, errorMessage(error)) : L.rejectFailed(deploy.app, errorMessage(error))),
    onSettled: invalidateDeploys,
  });
  const policy = useMutation({
    mutationKey: DEPLOYS_MUTATIONS.autoDeploy,
    mutationFn: ({ name, enabled }: AutoDeployRequest) => ipc.containers.setAutoDeploy(name, enabled),
    onSuccess: (container) => {
      queryClient.setQueryData<ServerContainer[]>(CONTAINERS_KEYS.list, (list) => upsertContainer(list, container));
      showToast(container.autoDeploy ? L.autoDeployOn(container.name) : L.autoDeployOff(container.name));
    },
    onError: (error) => showToast(L.autoDeployFailed(errorMessage(error))),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CONTAINERS_KEYS.list }),
  });
  const { mutate: decideMutate } = decision;
  const { mutate: policyMutate } = policy;
  const approve = useCallback((deploy: HostDeploy) => decideMutate({ decision: "approve", deploy }), [decideMutate]);
  const reject = useCallback((deploy: HostDeploy) => decideMutate({ decision: "reject", deploy }), [decideMutate]);
  const setAutoDeploy = useCallback((name: string, enabled: boolean) => policyMutate({ name, enabled }), [policyMutate]);
  return { approve, reject, setAutoDeploy, savingPolicy: policy.isPending };
}

export function usePendingDeploys(): ReadonlySet<string> {
  const ids = useMutationState({
    filters: { mutationKey: DEPLOYS_MUTATIONS.decide, status: "pending" },
    select: (mutation) => (mutation.state.variables as DecisionRequest | undefined)?.deploy.id ?? null,
  });
  const key = ids.filter(Boolean).sort().join("\n");
  return useMemo(() => new Set(key ? key.split("\n") : []), [key]);
}
