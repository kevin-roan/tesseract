import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { HostIosStatus, SimDevice, StopSignal } from "@tesseract/protocol";

import type { MenuOption } from "@/components/menu-sheet/types";
import { confirm } from "@/lib/confirm";
import { resetSettled } from "@/lib/mutations";

import { HOST_LOCKED, SIMULATOR_KILL_CONFIRM } from "../utils/content";
import { describeHostError } from "../utils/errors";
import { canBootSim, canKillSim, canShutdownSim, iosUnavailableNotice, otherBootedReason, pickSimDevice, simOptionMeta, withDevice } from "../utils/ios";
import { useHostClient } from "./use-host-client";
import { useHostIosStatus } from "./use-host-ios-status";
import { useHostNavigation } from "./use-host-navigation";

export function useHostIos(enabled: boolean) {
  const nav = useHostNavigation();
  const queryClient = useQueryClient();
  const { host } = useHostClient();
  const { status, key, sessionClient, dropOnLost, supported } = useHostIosStatus(enabled);
  const [selected, setSelected] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const merge = useCallback(
    (device: SimDevice) => queryClient.setQueryData<HostIosStatus>(key, (current) => (current ? withDevice(current, device) : current)),
    [queryClient, key],
  );

  const boot = useMutation({
    mutationFn: (udid: string) => {
      if (!sessionClient) throw new Error(HOST_LOCKED);
      return sessionClient.bootSimulator({ udid });
    },
    onSuccess: merge,
    onError: dropOnLost,
  });

  const shutdown = useMutation({
    mutationFn: (signal?: StopSignal) => {
      if (!sessionClient) throw new Error(HOST_LOCKED);
      return sessionClient.shutdownSimulator(signal ? { signal } : undefined);
    },
    onSuccess: merge,
    onError: dropOnLost,
  });

  const hostUrl = host?.baseUrl ?? null;
  const [scope, setScope] = useState(hostUrl);
  if (scope !== hostUrl) {
    setScope(hostUrl);
    setSelected(null);
  }
  const { reset: resetBoot } = boot;
  const { reset: resetShutdown } = shutdown;
  useEffect(() => {
    for (const reset of [resetBoot, resetShutdown]) reset();
  }, [hostUrl, resetBoot, resetShutdown]);

  const data = status.data;
  const device = pickSimDevice(data, selected);
  const options = useMemo<MenuOption[]>(
    () => (data?.devices ?? []).map((item) => ({ id: item.udid, label: item.name, description: simOptionMeta(item) })),
    [data?.devices],
  );
  const failure = boot.error ?? shutdown.error ?? status.error;
  const clearOutcomes = () => resetSettled([boot, shutdown]);
  const killing = shutdown.isPending && shutdown.variables === "SIGKILL";
  const confirmKill = async () => {
    if (!(await confirm(SIMULATOR_KILL_CONFIRM))) return;
    clearOutcomes();
    shutdown.mutate("SIGKILL");
  };

  return {
    status: data,
    supported,
    loading: status.isLoading,
    error: failure ? describeHostError(failure) : null,
    refresh: () => void status.refetch(),
    unavailable: data ? iosUnavailableNotice(data) : null,
    device,
    devicePicker: {
      visible: pickerOpen,
      options,
      open: () => setPickerOpen(true),
      close: () => setPickerOpen(false),
      select: (id: string) => {
        setSelected(id);
        setPickerOpen(false);
      },
    },
    blocked: otherBootedReason(data, device),
    canBoot: data ? canBootSim(data, device) : false,
    canShutdown: canShutdownSim(device),
    canKill: canKillSim(device),
    canOpen: data?.available === true && device?.state === "booted",
    boot: () => {
      if (!device) return;
      clearOutcomes();
      boot.mutate(device.udid);
    },
    booting: boot.isPending,
    shutdown: () => {
      clearOutcomes();
      shutdown.mutate(undefined);
    },
    shuttingDown: shutdown.isPending && !killing,
    kill: () => void confirmKill(),
    killing,
    openScreen: () => {
      if (device) nav.screen({ kind: "ios", serial: device.udid });
    },
  };
}

export type HostIosState = ReturnType<typeof useHostIos>;
