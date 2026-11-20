import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccountDevice } from "@tesseract/protocol";
import { useCallback, useState } from "react";
import type { AccountState } from "../../../../shared/contracts/account";
import { errorMessage } from "../../../components/FormDialog";
import { ACCOUNT_KEYS } from "../../../features/account/constants";
import { useAccountState } from "../../../features/account/hooks/use-account-state";
import { useSignIn } from "../../../features/account/hooks/use-sign-in";
import { ipc } from "../../../lib/ipc";
import { usePreferencesToast } from "../shared/use-preferences-toast";
import { ACCOUNT_LABELS as L } from "./labels";
import { deviceName } from "./model";

export type AccountDialog = { kind: "delete" } | { kind: "remove"; device: AccountDevice } | null;

export function useAccount() {
  const queryClient = useQueryClient();
  const toast = usePreferencesToast();
  const state = useAccountState();
  const signIn = useSignIn(state);
  const signedIn = Boolean(state?.account);
  const [dialog, setDialog] = useState<AccountDialog>(null);

  const devices = useQuery({
    queryKey: [...ACCOUNT_KEYS.devices, state?.account?.id ?? null],
    queryFn: () => ipc.account.devices(),
    enabled: signedIn,
    retry: false,
    staleTime: 0,
  });

  const setState = useCallback((next: AccountState) => queryClient.setQueryData(ACCOUNT_KEYS.state, next), [queryClient]);

  const signOut = useMutation({
    mutationFn: () => ipc.account.signOut(),
    onSuccess: (next) => {
      setState(next);
      toast(L.signedOut);
    },
    onError: (error) => toast(L.signOutFailed(errorMessage(error)), true),
  });

  const remove = useMutation({
    mutationFn: (device: AccountDevice) => ipc.account.removeDevice(device.id),
    onSuccess: (list, device) => {
      queryClient.setQueryData([...ACCOUNT_KEYS.devices, state?.account?.id ?? null], list);
      toast(L.devices.removed(deviceName(device)));
    },
    onError: (error) => toast(L.devices.removeFailed(errorMessage(error)), true),
  });

  const deleteAccount = useMutation({
    mutationFn: () => ipc.account.deleteAccount(),
    onSuccess: (next) => {
      setState(next);
      toast(L.danger.done);
    },
    onError: (error) => toast(L.danger.failed(errorMessage(error)), true),
  });

  const refresh = useCallback(() => {
    void ipc.account
      .refresh()
      .then(setState)
      .catch(() => undefined);
    if (signedIn) void devices.refetch();
  }, [devices, setState, signedIn]);

  const confirm = useCallback(() => {
    if (dialog?.kind === "delete") deleteAccount.mutate();
    if (dialog?.kind === "remove") remove.mutate(dialog.device);
    setDialog(null);
  }, [deleteAccount, dialog, remove]);

  return {
    state,
    signIn,
    signedIn,
    devices: devices.data ?? [],
    devicesError: devices.error ? L.devices.loadFailed(errorMessage(devices.error)) : null,
    devicesLoading: devices.isLoading,
    busy: signOut.isPending || deleteAccount.isPending || remove.isPending,
    signOut: () => signOut.mutate(),
    askRemove: (device: AccountDevice) => setDialog({ kind: "remove", device }),
    askDelete: () => setDialog({ kind: "delete" }),
    dialog,
    closeDialog: () => setDialog(null),
    confirm,
    refresh,
  };
}
