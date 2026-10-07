import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { AccelResult, AndroidHostSupport, AvdInfo, SdkCandidate, SdkCatalog } from "../../../../shared/contracts/android";
import type { OnboardingState } from "../../../../shared/contracts/onboarding";
import { ipc } from "../../../lib/ipc";
import { QUERY_KEYS } from "../constants";

const NO_AVDS: AvdInfo[] = [];
const NO_CANDIDATES: SdkCandidate[] = [];

const STATIC = { retry: false, staleTime: Number.POSITIVE_INFINITY, refetchOnWindowFocus: false } as const;

export interface AndroidSources {
  support: AndroidHostSupport | null;
  candidates: SdkCandidate[];
  candidatesLoaded: boolean;
  catalog: SdkCatalog | null;
  catalogLoading: boolean;
  catalogError: string | null;
  retryCatalog(): void;
}

export interface SdkDetails {
  avds: AvdInfo[];
  accel: AccelResult | null;
  accelLoading: boolean;
  recheckAccel(): void;
}

function errorMessage(error: unknown): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : String(error);
}

export function useAndroidSources(state: OnboardingState | null): AndroidSources {
  const client = useQueryClient();
  const supportQuery = useQuery({
    queryKey: QUERY_KEYS.support,
    queryFn: () => ipc.android.support(),
    enabled: !state?.androidSupport,
    ...STATIC,
  });
  const support = state?.androidSupport ?? supportQuery.data ?? null;
  const supported = support?.supported === true;

  const candidatesQuery = useQuery({
    queryKey: QUERY_KEYS.candidates,
    queryFn: () => ipc.android.sdkCandidates(),
    enabled: supported,
    ...STATIC,
  });

  const catalogQuery = useQuery({
    queryKey: QUERY_KEYS.catalog,
    queryFn: () => ipc.onboarding.androidCatalog(false),
    enabled: supported,
    ...STATIC,
  });

  const retryCatalog = useCallback(() => {
    client
      .fetchQuery({ queryKey: QUERY_KEYS.catalog, queryFn: () => ipc.onboarding.androidCatalog(true), staleTime: 0 })
      .catch(() => undefined);
  }, [client]);

  return {
    support,
    candidates: candidatesQuery.data ?? NO_CANDIDATES,
    candidatesLoaded: candidatesQuery.isFetched,
    catalog: catalogQuery.data ?? null,
    catalogLoading: catalogQuery.isFetching,
    catalogError: errorMessage(catalogQuery.error),
    retryCatalog,
  };
}

export function useSdkDetails(supported: boolean, sdkRoot: string | null, emulatorInstalled: boolean): SdkDetails {
  const avdsQuery = useQuery({
    queryKey: QUERY_KEYS.avds(sdkRoot ?? ""),
    queryFn: () => ipc.android.avds(sdkRoot ?? ""),
    enabled: supported && sdkRoot !== null,
    ...STATIC,
  });

  const accelRoot = emulatorInstalled ? sdkRoot : null;
  const accelQuery = useQuery({
    queryKey: QUERY_KEYS.accel(accelRoot),
    queryFn: () => ipc.android.accel(accelRoot),
    enabled: supported,
    ...STATIC,
  });

  const { refetch } = accelQuery;
  const recheckAccel = useCallback(() => {
    refetch().catch(() => undefined);
  }, [refetch]);

  return {
    avds: avdsQuery.data ?? NO_AVDS,
    accel: accelQuery.data ?? null,
    accelLoading: accelQuery.isFetching,
    recheckAccel,
  };
}
