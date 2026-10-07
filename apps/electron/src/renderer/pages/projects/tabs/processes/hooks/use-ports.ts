import type { TheOneClient } from "@theone/client";
import type { ListeningPort } from "@theone/protocol";
import { useCallback, useMemo, useState } from "react";
import { usePoller } from "../../../../../app/connection";
import { PORTS_POLL_MS } from "../constants";
import { hostOf, portUrl, projectPorts } from "../model";

export interface PortEntry {
  port: ListeningPort;
  url: string | null;
}

export function usePorts(client: TheOneClient | null, projectId: string, active: boolean): PortEntry[] {
  const [ports, setPorts] = useState<ListeningPort[]>([]);
  const fetch = useCallback((signal: AbortSignal) => (client ? client.ports({ signal }) : Promise.resolve(null)), [client]);
  usePoller(fetch, PORTS_POLL_MS, {
    enabled: active && client !== null,
    refreshOnVisible: true,
    onResult: (result) => {
      if (result) setPorts(result.ports);
    },
  });
  const fallbackHost = hostOf(client?.baseUrl);
  return useMemo(
    () => projectPorts(ports, projectId).map((port) => ({ port, url: portUrl(port, fallbackHost) })),
    [ports, projectId, fallbackHost],
  );
}
