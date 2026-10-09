import { useCallback, useEffect, useRef } from "react";
import { useApiClient } from "../../../app/data";
import { filesStore, scopedData, useFilesStore } from "../store";

export function useTaildrop() {
  const client = useApiClient();
  const scope = client?.baseUrl ?? null;
  const taildrop = useFilesStore((state) => scopedData(state, scope).taildrop);
  const loading = useRef(false);

  const load = useCallback(() => {
    if (!client || !scope || loading.current) return;
    loading.current = true;
    client
      .taildropTargets()
      .then((targets) => filesStore.setTaildrop(scope, targets), () => undefined)
      .finally(() => {
        loading.current = false;
      });
  }, [client, scope]);

  useEffect(() => {
    if (scope && !scopedData(useFilesStore.getState(), scope).taildrop) load();
  }, [scope, load]);

  return { taildrop, load };
}
