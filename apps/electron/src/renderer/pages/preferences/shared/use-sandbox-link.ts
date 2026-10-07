import { useMemo } from "react";
import { statusTitle, useConnectionClient, useConnectionState } from "../../../app/connection";
import { offlineMessage } from "./format";

export function useSandboxLink() {
  const client = useConnectionClient();
  const status = useConnectionState((state) => state.status);
  const health = useConnectionState((state) => state.health);
  const config = useConnectionState((state) => state.config);
  const error = useConnectionState((state) => state.errorMessage);
  const online = status === "online" && client !== null;
  return useMemo(
    () => ({
      client,
      online,
      baseUrl: client?.baseUrl ?? null,
      offline: offlineMessage(statusTitle({ status, health, config }), error),
    }),
    [client, online, status, health, config, error],
  );
}
