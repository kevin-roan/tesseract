import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import type { AvdInfo, PackageProgress, SdkCandidate } from "../../../../../shared/contracts/android";
import { errorMessage } from "../../../../components/FormDialog";
import { ipc } from "../../../../lib/ipc";
import { ANDROID_SETTINGS_KEYS as KEYS } from "../constants";
import { appendLine } from "../model";

const STATIC = { retry: false, staleTime: Number.POSITIVE_INFINITY, refetchOnWindowFocus: false } as const;
const NO_CANDIDATES: SdkCandidate[] = [];
export const NO_AVDS: AvdInfo[] = [];

export function useAndroidSources() {
  const client = useQueryClient();
  const [progress, setProgress] = useState<PackageProgress | null>(null);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const stops = [
      ipc.android.on("emulator", (state) => client.setQueryData(KEYS.emulator, state)),
      ipc.android.on("progress", setProgress),
      ipc.android.on("log", (line) => setLog((lines) => appendLine(lines, line))),
    ];
    return () => stops.forEach((stop) => stop());
  }, [client]);

  const support = useQuery({ queryKey: KEYS.support, queryFn: () => ipc.android.support(), ...STATIC });
  const supported = support.data?.supported === true;
  const candidates = useQuery({ queryKey: KEYS.candidates, queryFn: () => ipc.android.sdkCandidates(), enabled: supported, ...STATIC });
  const catalog = useQuery({ queryKey: KEYS.catalog, queryFn: () => ipc.android.catalog(false), enabled: supported, ...STATIC });
  const emulator = useQuery({ queryKey: KEYS.emulator, queryFn: () => ipc.android.emulator(), enabled: supported, ...STATIC });

  const retryCatalog = useCallback(() => {
    client.fetchQuery({ queryKey: KEYS.catalog, queryFn: () => ipc.android.catalog(true), staleTime: 0 }).catch(() => undefined);
  }, [client]);

  return {
    support: support.data ?? null,
    candidates: candidates.data ?? NO_CANDIDATES,
    refreshCandidates: () => void candidates.refetch(),
    catalog: catalog.data ?? null,
    catalogLoading: catalog.isFetching,
    catalogError: catalog.error ? errorMessage(catalog.error) : null,
    retryCatalog,
    emulator: emulator.data ?? null,
    progress,
    resetProgress: () => setProgress(null),
    log,
    clearLog: () => setLog([]),
  };
}

export type AndroidSettingsSources = ReturnType<typeof useAndroidSources>;
