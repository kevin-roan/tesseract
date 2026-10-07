import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useEffect } from "react";
import type { OnboardingState } from "../../../shared/contracts/onboarding";
import { ipc } from "../../lib/ipc";
import { ONBOARDING_STATE_KEY } from "./constants";

export function useOnboardingStateQuery(): UseQueryResult<OnboardingState> {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ONBOARDING_STATE_KEY,
    queryFn: () => ipc.onboarding.get(),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });
  useEffect(() => ipc.onboarding.on("state", (state) => client.setQueryData(ONBOARDING_STATE_KEY, state)), [client]);
  return query;
}

export function useOnboardingState(): OnboardingState | null {
  return useOnboardingStateQuery().data ?? null;
}
