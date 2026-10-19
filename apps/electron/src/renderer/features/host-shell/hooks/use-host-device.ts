import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AndroidLinkInfo } from "@tesseract/protocol";
import { useCallback, useMemo } from "react";
import type { EmulatorStopSignal } from "../../../../shared/contracts/hostShell";
import { HOST_EMULATOR_REFRESH_MS } from "../constants";
import { useHostAccess } from "./use-host-access";

export interface HostDeviceOptions {
  enabled?: boolean;
}

export interface SandboxTarget {
  url: string;
  token: string;
}

export interface HostDeviceApi<Status extends { link: AndroidLinkInfo }> {
  key: readonly string[];
  status(): Promise<Status>;
  start(target: string): Promise<Status>;
  stop(signal: EmulatorStopSignal): Promise<Status>;
  link(url: string, token: string): Promise<AndroidLinkInfo>;
  busy(status: Status | null): boolean;
}

const message = (error: unknown) => (error instanceof Error ? error.message : error ? String(error) : null);

export function useHostDevice<Status extends { link: AndroidLinkInfo }>(api: HostDeviceApi<Status>, { enabled = true }: HostDeviceOptions = {}) {
  const { access, state } = useHostAccess();
  const queryClient = useQueryClient();
  const ready = access === "ready";
  const url = state?.pairing?.url ?? null;
  const key = useMemo(() => [...api.key, url ?? ""], [api.key, url]);
  const query = useQuery({
    queryKey: key,
    queryFn: () => api.status(),
    enabled: enabled && ready,
    retry: false,
    refetchInterval: (current) => (api.busy(current.state.data ?? null) ? HOST_EMULATOR_REFRESH_MS.busy : HOST_EMULATOR_REFRESH_MS.idle),
  });

  const set = useCallback((status: Status) => queryClient.setQueryData(key, status), [queryClient, key]);
  const patchLink = useCallback(
    (link: AndroidLinkInfo) => queryClient.setQueryData<Status>(key, (current) => (current ? { ...current, link } : current)),
    [queryClient, key],
  );

  const start = useMutation({ mutationFn: (target: string) => api.start(target), onSuccess: set });
  const stop = useMutation({ mutationFn: (signal: EmulatorStopSignal) => api.stop(signal), onSuccess: set });
  const link = useMutation({ mutationFn: ({ url: sandboxUrl, token }: SandboxTarget) => api.link(sandboxUrl, token), onSuccess: patchLink });

  const { refetch } = query;
  const { mutate: stopWith, mutateAsync: stopAsync } = stop;
  const { reset: resetStart } = start;
  const { reset: resetStop } = stop;
  const { reset: resetLink } = link;

  return {
    access,
    ready,
    status: ready ? (query.data ?? null) : null,
    loading: ready && query.isPending,
    error: message(start.error ?? stop.error ?? link.error ?? query.error),
    refresh: useCallback(() => void refetch(), [refetch]),
    start: start.mutate,
    starting: start.isPending,
    stop: useCallback(() => stopWith("SIGTERM"), [stopWith]),
    kill: useCallback(() => stopWith("SIGKILL"), [stopWith]),
    stopWith: stopAsync,
    stopping: stop.isPending,
    link: link.mutate,
    linking: link.isPending,
    clearError: useCallback(() => {
      resetStart();
      resetStop();
      resetLink();
    }, [resetStart, resetStop, resetLink]),
  };
}

export type HostDevice<Status extends { link: AndroidLinkInfo }> = ReturnType<typeof useHostDevice<Status>>;
