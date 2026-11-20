import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useHostAccess } from "../../host-shell/hooks/use-host-access";
import { useMasterHost } from "../../master-host/hooks/use-master-host";
import { CONTAINERS_SCOPE } from "../constants";

/** Drops one machine's containers when the active machine changes, and reloads once a server's host session is unlocked. */
export function useContainersMachine() {
  const { state } = useMasterHost();
  const { access } = useHostAccess();
  const queryClient = useQueryClient();
  const remote = state?.kind === "linked";
  const ready = !remote || access === "ready";
  const key = state?.kind === "linked" ? `${state.sandboxUrl}|${state.host.url}` : (state?.kind ?? "none");

  const shown = useRef(key);
  useEffect(() => {
    if (shown.current === key) return;
    shown.current = key;
    void queryClient.resetQueries({ queryKey: CONTAINERS_SCOPE });
  }, [key, queryClient]);

  useEffect(() => {
    if (ready) void queryClient.invalidateQueries({ queryKey: CONTAINERS_SCOPE });
  }, [ready, queryClient]);

  return { remote, ready };
}
