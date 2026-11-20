import { useEffect } from "react";

import { useAccountStore } from "../store/account-store";

export function useAccountSession() {
  const session = useAccountStore((state) => state.session);
  const hydrated = useAccountStore((state) => state.hydrated);
  const hydrate = useAccountStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return {
    hydrated,
    session,
    token: session?.token ?? null,
    account: session?.account ?? null,
    signedIn: session !== null,
  };
}
