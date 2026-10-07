import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { SyncBackState } from "../../../../../../shared/contracts/syncback";
import { ipc } from "../../../../../lib/ipc";

const SYNCBACK_STATE_KEY = ["syncback", "state"] as const;
const IDLE_STATE: SyncBackState = { revision: 0, busy: [] };

export function useSyncBackState(): SyncBackState {
  const queryClient = useQueryClient();
  useEffect(() => ipc.syncback.on("state", (state) => queryClient.setQueryData(SYNCBACK_STATE_KEY, state)), [queryClient]);
  const query = useQuery({
    queryKey: SYNCBACK_STATE_KEY,
    queryFn: () => ipc.syncback.state().catch(() => IDLE_STATE),
    staleTime: Infinity,
  });
  return query.data ?? IDLE_STATE;
}
