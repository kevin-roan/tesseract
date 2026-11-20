import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { accountApi } from "../api/client";
import { describeAccountError } from "../api/errors";
import { accountKeys } from "../api/query-keys";
import { connectDevice } from "../services/lifecycle";
import { useAccountStore } from "../store/account-store";
import { deviceRows } from "../utils/view";

export function useAccountDevices() {
  const session = useAccountStore((state) => state.session);
  const token = session?.token ?? null;
  const key = accountKeys.devices(session?.account.id ?? "");
  const queryClient = useQueryClient();

  const devices = useQuery({
    queryKey: key,
    queryFn: () => accountApi().devices(token as string),
    enabled: token !== null,
  });

  const remove = useMutation({
    mutationFn: (id: string) => accountApi().removeDevice(token as string, id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const rows = useMemo(() => deviceRows(devices.data?.devices ?? []), [devices.data]);

  return {
    rows,
    loading: devices.isPending && token !== null,
    error: devices.error ? describeAccountError(devices.error) : null,
    refetch: devices.refetch,
    refreshing: devices.isRefetching,
    remove: remove.mutateAsync,
    removing: remove.isPending ? remove.variables : null,
    removeError: remove.error ? describeAccountError(remove.error) : null,
  };
}

export function useConnectDevice() {
  const token = useAccountStore((state) => state.session?.token ?? null);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => connectDevice(token as string),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.all }),
  });
}
