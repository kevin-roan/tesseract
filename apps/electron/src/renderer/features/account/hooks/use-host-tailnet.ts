import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { HostTailnetState } from "../../../../shared/contracts/tailnet";
import { ipc } from "../../../lib/ipc";
import { TAILNET_STATE_KEY } from "../constants";

/** The host's Tesseract Network node (tesseract-tailnet), kept current by the `tailnet:state` event. */
export function useHostTailnetState(): HostTailnetState | null {
  const queryClient = useQueryClient();
  useEffect(() => ipc.tailnet.on("state", (state) => queryClient.setQueryData(TAILNET_STATE_KEY, state)), [queryClient]);
  const query = useQuery({
    queryKey: TAILNET_STATE_KEY,
    queryFn: () => ipc.tailnet.state(),
    staleTime: Infinity,
    retry: false,
  });
  return query.data ?? null;
}
