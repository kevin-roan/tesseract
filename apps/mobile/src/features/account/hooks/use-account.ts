import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { accountApi } from "../api/client";
import { isUnauthorized } from "../api/errors";
import { accountKeys } from "../api/query-keys";
import { endSession } from "../services/lifecycle";
import { useAccountStore } from "../store/account-store";
import { useAccountSession } from "./use-account-session";

const MAX_RETRIES = 2;

export function useAccount() {
  const current = useAccountSession();
  const updateAccount = useAccountStore((state) => state.updateAccount);
  const { token, account } = current;

  const me = useQuery({
    queryKey: accountKeys.me(account?.id ?? ""),
    queryFn: () => accountApi().me(token as string),
    enabled: token !== null,
    retry: (count, error) => count < MAX_RETRIES && !isUnauthorized(error),
  });

  useEffect(() => {
    if (me.data) updateAccount(me.data);
  }, [me.data, updateAccount]);

  const expired = isUnauthorized(me.error);
  useEffect(() => {
    if (expired) void endSession();
  }, [expired]);

  return { ...current, refetch: me.refetch };
}
