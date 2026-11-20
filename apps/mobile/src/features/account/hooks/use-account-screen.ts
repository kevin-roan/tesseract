import { useCallback, useMemo } from "react";

import { confirm } from "@/lib/confirm";
import { resetSettled } from "@/lib/mutations";
import { useTailnetStatus } from "@/features/tailnet";

import { describeAccountError } from "../api/errors";
import { CONFIRM_COPY } from "../utils/content";
import { accountRows, needsReconnect, tailnetRows, tailnetStateView, type DeviceRow } from "../utils/view";
import { useAccount } from "./use-account";
import { useDeleteAccount, useSignOut } from "./use-account-auth";
import { useAccountDevices, useConnectDevice } from "./use-account-devices";
import { useAccountNavigation } from "./use-account-navigation";

export function useAccountScreen() {
  const nav = useAccountNavigation();
  const { account, hydrated, refetch } = useAccount();
  const status = useTailnetStatus();
  const devices = useAccountDevices();
  const connect = useConnectDevice();
  const signOut = useSignOut();
  const deletion = useDeleteAccount();

  const { mutate: signOutNow } = signOut;
  const { mutate: deleteNow } = deletion;
  const { remove } = devices;

  const confirmSignOut = useCallback(async () => {
    if (await confirm(CONFIRM_COPY.signOut)) signOutNow();
  }, [signOutNow]);

  const confirmDelete = useCallback(async () => {
    if (await confirm(CONFIRM_COPY.deleteAccount)) deleteNow();
  }, [deleteNow]);

  const removeDevice = useCallback(
    async (row: DeviceRow) => {
      if (await confirm(CONFIRM_COPY.removeDevice(row.hostname))) await remove(row.id).catch(() => undefined);
    },
    [remove],
  );

  const refresh = useCallback(() => {
    resetSettled([connect, signOut, deletion]);
    void refetch();
    void devices.refetch();
  }, [connect, signOut, deletion, refetch, devices]);

  const failure = deletion.error ?? connect.error;

  return {
    hydrated,
    account,
    accountRows: useMemo(() => (account ? accountRows(account) : []), [account]),
    network: {
      state: tailnetStateView(status),
      rows: useMemo(() => tailnetRows(status), [status]),
      error: status?.error ?? null,
      canReconnect: needsReconnect(status),
      reconnect: () => connect.mutate(),
      reconnecting: connect.isPending,
    },
    devices: {
      rows: devices.rows,
      loading: devices.loading,
      error: devices.error ?? devices.removeError,
      removing: devices.removing,
      remove: removeDevice,
      retry: () => void devices.refetch(),
    },
    signOut: confirmSignOut,
    signingOut: signOut.isPending,
    deleteAccount: confirmDelete,
    deleting: deletion.isPending,
    error: failure ? describeAccountError(failure) : null,
    refreshing: devices.refreshing,
    refresh,
    nav,
  };
}
