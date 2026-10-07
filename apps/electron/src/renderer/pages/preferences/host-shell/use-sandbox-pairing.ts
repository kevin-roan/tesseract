import { useMemo } from "react";
import { pairingLinkFor, useIsOnline } from "../../../app/connection";
import { useConnectionSnapshot } from "../../../app/data";
import type { SandboxPairing } from "../../../components/PairDialog";

export function useSandboxPairing(): SandboxPairing {
  const config = useConnectionSnapshot().data?.config ?? null;
  const online = useIsOnline();
  return useMemo<SandboxPairing>(() => {
    if (!config) return { kind: "unconfigured" };
    const link = pairingLinkFor(config);
    if (!link) return { kind: "unconfigured" };
    return { kind: "ready", link, url: config.pairingUrl ?? config.apiUrl, name: config.name, online };
  }, [config, online]);
}
