import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { HostAndroidStatus } from "@theone/protocol";

import type { MenuOption } from "@/components/menu-sheet/types";
import { useActiveSandbox } from "@/features/sandbox/hooks/use-sandbox-client";
import { selectActiveToken, useSandboxStore } from "@/features/sandbox/store/sandbox-store";
import { confirm } from "@/lib/confirm";
import { resetSettled } from "@/lib/mutations";

import {
  canStartEmulator,
  canStopEmulator,
  deviceLabel,
  deviceMeta,
  isLinkedTo,
  isolationNotice,
  linkBlockedReason,
  pickAvd,
  pickDevice,
  streamableDevices,
} from "../utils/android";
import { ANDROID_COPY, HOST_LOCKED, LINK_CONFIRM } from "../utils/content";
import { describeHostError } from "../utils/errors";
import { useHostAndroidStatus } from "./use-host-android-status";
import { useHostNavigation } from "./use-host-navigation";

export function useHostAndroid(enabled: boolean) {
  const nav = useHostNavigation();
  const queryClient = useQueryClient();
  const { status, key, sessionClient, dropOnLost } = useHostAndroidStatus(enabled);
  const sandbox = useActiveSandbox();
  const sandboxToken = useSandboxStore(selectActiveToken);
  const [selected, setSelected] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);

  const patch = useCallback(
    (update: Partial<HostAndroidStatus>) =>
      queryClient.setQueryData<HostAndroidStatus>(key, (current) => (current ? { ...current, ...update } : current)),
    [queryClient, key],
  );

  const start = useMutation({
    mutationFn: (avd: string) => {
      if (!sessionClient) throw new Error(HOST_LOCKED);
      return sessionClient.startEmulator({ avd });
    },
    onSuccess: (emulator) => patch({ emulator }),
    onError: dropOnLost,
  });

  const stop = useMutation({
    mutationFn: () => {
      if (!sessionClient) throw new Error(HOST_LOCKED);
      return sessionClient.stopEmulator();
    },
    onSuccess: (emulator) => patch({ emulator }),
    onError: dropOnLost,
  });

  const link = useMutation({
    mutationFn: () => {
      if (!sessionClient) throw new Error(HOST_LOCKED);
      if (!sandbox || !sandboxToken) throw new Error(ANDROID_COPY.noSandbox);
      return sessionClient.linkSandbox({ sandboxUrl: sandbox.baseUrl, token: sandboxToken });
    },
    onSuccess: (info) => patch({ link: info }),
    onError: dropOnLost,
  });

  const unlink = useMutation({
    mutationFn: () => {
      if (!sessionClient) throw new Error(HOST_LOCKED);
      return sessionClient.unlinkSandbox();
    },
    onSuccess: (info) => patch({ link: info }),
    onError: dropOnLost,
  });

  const data = status.data;
  const avd = pickAvd(data, selected);
  const avdOptions = useMemo<MenuOption[]>(() => (data?.avds ?? []).map((name) => ({ id: name, label: name })), [data?.avds]);
  const device = pickDevice(data, selectedDevice);
  const deviceOptions = useMemo<MenuOption[]>(
    () => streamableDevices(data).map((item) => ({ id: item.serial, label: deviceLabel(item), description: deviceMeta(item) })),
    [data],
  );
  const failure = start.error ?? stop.error ?? link.error ?? unlink.error ?? status.error;
  const clearOutcomes = () => resetSettled([start, stop, link, unlink]);
  const confirmLink = async () => {
    if (!(await confirm(LINK_CONFIRM))) return;
    clearOutcomes();
    link.mutate();
  };

  return {
    status: data,
    loading: status.isLoading,
    error: failure ? describeHostError(failure) : null,
    refresh: () => void status.refetch(),
    avd,
    avdPicker: {
      visible: pickerOpen,
      options: avdOptions,
      open: () => setPickerOpen(true),
      close: () => setPickerOpen(false),
      select: (id: string) => {
        setSelected(id);
        setPickerOpen(false);
      },
    },
    canStart: data ? canStartEmulator(data, avd) : false,
    canStop: data ? canStopEmulator(data.emulator.state) : false,
    device,
    devicePicker: {
      visible: devicePickerOpen,
      options: deviceOptions,
      open: () => setDevicePickerOpen(true),
      close: () => setDevicePickerOpen(false),
      select: (id: string) => {
        setSelectedDevice(id);
        setDevicePickerOpen(false);
      },
    },
    canOpen: device !== null,
    start: () => {
      if (!avd) return;
      clearOutcomes();
      start.mutate(avd);
    },
    starting: start.isPending,
    stop: () => {
      clearOutcomes();
      stop.mutate();
    },
    stopping: stop.isPending,
    openScreen: () => {
      if (device) nav.android(device.serial);
    },
    openStreamSettings: nav.stream,
    sandboxName: sandbox?.name ?? null,
    canLink: sandbox !== null && sandboxToken !== null,
    linkBlocked: linkBlockedReason(data),
    isolationNotice: data ? isolationNotice(data) : null,
    linkedToActive: data ? isLinkedTo(data.link, sandbox?.baseUrl ?? null) : false,
    link: () => void confirmLink(),
    linking: link.isPending,
    unlink: () => {
      clearOutcomes();
      unlink.mutate();
    },
    unlinking: unlink.isPending,
  };
}

export type HostAndroidState = ReturnType<typeof useHostAndroid>;
