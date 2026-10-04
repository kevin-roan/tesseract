import { useEffect, useMemo } from "react";

import { getHostClient, getHostSessionClient } from "../api/client";
import { useHostSessionStore } from "../store/host-session-store";
import { useHostStore } from "../store/host-store";

export function useHostClient() {
  const host = useHostStore((state) => state.host);
  const token = useHostStore((state) => state.token);
  const hydrated = useHostStore((state) => state.hydrated);
  const hydrate = useHostStore((state) => state.hydrate);
  const session = useHostSessionStore((state) => state.current);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const client = useMemo(() => (host && token ? getHostClient(host.baseUrl, token) : null), [host, token]);
  const sessionClient = useMemo(
    () => (client && session ? getHostSessionClient(client, session.session) : null),
    [client, session],
  );

  return { host, hydrated, client, session, sessionClient, missingToken: hydrated && host !== null && token === null };
}
