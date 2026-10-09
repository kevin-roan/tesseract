import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { ContainersPhase } from "../../../../shared/contracts/containers";
import { ipc } from "../../../lib/ipc";
import { CONTAINERS_KEYS } from "../constants";

const IDLE: ContainersPhase = { kind: "idle" };

export function useContainersPhase(): ContainersPhase {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      ipc.containers.on("phase", (phase) => {
        const previous = queryClient.getQueryData<ContainersPhase>(CONTAINERS_KEYS.phase);
        queryClient.setQueryData<ContainersPhase>(CONTAINERS_KEYS.phase, phase);
        if (phase.kind === "idle" && previous?.kind === "building") void queryClient.invalidateQueries({ queryKey: CONTAINERS_KEYS.report });
      }),
    [queryClient],
  );
  const query = useQuery({ queryKey: CONTAINERS_KEYS.phase, queryFn: () => ipc.containers.phase(), staleTime: Infinity });
  return query.data ?? IDLE;
}
