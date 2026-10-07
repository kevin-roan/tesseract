import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { OnboardingState } from "../../../shared/contracts/onboarding";
import { ONBOARDING_STATE_KEY } from "./constants";

export function useOnboardingAction<Args extends unknown[]>(run: (...args: Args) => Promise<OnboardingState>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: Args) => run(...args),
    onSuccess: (state) => client.setQueryData(ONBOARDING_STATE_KEY, state),
  });
}
