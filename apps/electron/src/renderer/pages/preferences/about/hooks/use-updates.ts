import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import type { UpdateState } from "../../../../../shared/contracts/updates";
import { errorMessage } from "../../../../components/FormDialog";
import { ipc } from "../../../../lib/ipc";
import { usePreferencesToast } from "../../shared/use-preferences-toast";
import { ABOUT_KEYS } from "../constants";
import { ABOUT_LABELS } from "../labels";
import type { UpdateAction } from "../model";

export function useUpdates() {
  const client = useQueryClient();
  const toast = usePreferencesToast();
  useEffect(() => ipc.updates.on("state", (state) => client.setQueryData(ABOUT_KEYS.updates, state)), [client]);
  const query = useQuery({ queryKey: ABOUT_KEYS.updates, queryFn: () => ipc.updates.state(), staleTime: Number.POSITIVE_INFINITY, retry: false });

  const store = useCallback((state: UpdateState) => client.setQueryData(ABOUT_KEYS.updates, state), [client]);
  const fail = useCallback((error: unknown) => toast(ABOUT_LABELS.updates.failed(errorMessage(error)), true), [toast]);

  const run = useCallback(
    (action: UpdateAction) => {
      if (action === "check") {
        store({ kind: "checking" });
        ipc.updates.check().then(store).catch(fail);
      } else if (action === "download") ipc.updates.download().then(store).catch(fail);
      else if (action === "install") ipc.updates.install().catch(fail);
    },
    [fail, store],
  );

  return { state: query.data ?? null, run };
}
