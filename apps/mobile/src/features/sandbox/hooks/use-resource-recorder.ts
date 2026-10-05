import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { sandboxKeys } from "../api/query-keys";
import { useResourceHistoryStore } from "../store/resource-history-store";
import { STATUS_REFRESH_INTERVAL_MS } from "../utils/constants";
import { useSandboxClient } from "./use-sandbox-client";

/**
 * Polls the active sandbox's status while the app is in the foreground and
 * keeps every reading in the resource history, whichever screen is open.
 */
export function useResourceRecorder(): void {
  const { sandbox, client } = useSandboxClient();
  const record = useResourceHistoryStore((state) => state.record);
  const sandboxId = sandbox?.id ?? null;

  const status = useQuery({
    queryKey: sandboxId ? sandboxKeys.status(sandboxId) : sandboxKeys.root,
    queryFn: ({ signal }) => {
      if (!client) throw new Error("No sandbox is paired.");
      return client.status({ signal });
    },
    enabled: client !== null,
    refetchInterval: STATUS_REFRESH_INTERVAL_MS,
    notifyOnChangeProps: ["data", "dataUpdatedAt"],
  });

  useEffect(() => {
    if (sandboxId && status.data && status.dataUpdatedAt) record(sandboxId, status.data, status.dataUpdatedAt);
  }, [sandboxId, status.data, status.dataUpdatedAt, record]);
}
