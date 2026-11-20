import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { AccountState } from "../../../../shared/contracts/account";
import { ipc } from "../../../lib/ipc";
import { ACCOUNT_KEYS } from "../constants";

/** The desktop's Tesseract account, kept current by the `account:state` event. */
export function useAccountState(): AccountState | null {
  const queryClient = useQueryClient();
  useEffect(() => ipc.account.on("state", (state) => queryClient.setQueryData(ACCOUNT_KEYS.state, state)), [queryClient]);
  const query = useQuery({
    queryKey: ACCOUNT_KEYS.state,
    queryFn: () => ipc.account.state(),
    staleTime: Infinity,
    retry: false,
  });
  return query.data ?? null;
}
