import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { errorMessage } from "../../../components/FormDialog";
import { showToast } from "../../../components/Toast";
import { ipc } from "../../../lib/ipc";
import { DOMAINS_LABELS as L } from "../labels";
import { useContainersReport, useSetReport } from "./use-containers-report";

export function useCloudflareToken() {
  const { report, checking, refresh } = useContainersReport();
  const setReport = useSetReport();
  const [token, setToken] = useState("");
  const save = useMutation({
    mutationFn: (value: string | null) => ipc.containers.setCloudflareToken(value),
    onSuccess: (next, value) => {
      setReport(next);
      if (value === null) showToast(L.cloudflare.disconnectedToast);
      else if (next.cloudflare.connected) {
        setToken("");
        showToast(L.cloudflare.connectedToast);
      }
    },
    onError: (error, value) => showToast((value === null ? L.cloudflare.disconnectFailed : L.cloudflare.connectFailed)(errorMessage(error))),
  });
  const { mutate } = save;
  const trimmed = token.trim();
  const connect = useCallback(() => {
    if (trimmed) mutate(trimmed);
  }, [mutate, trimmed]);
  const disconnect = useCallback(() => mutate(null), [mutate]);
  return {
    cloudflare: report?.cloudflare ?? null,
    checking,
    refresh,
    token,
    setToken,
    canConnect: trimmed.length > 0 && !save.isPending,
    connecting: save.isPending && save.variables !== null,
    disconnecting: save.isPending && save.variables === null,
    connect,
    disconnect,
  };
}
