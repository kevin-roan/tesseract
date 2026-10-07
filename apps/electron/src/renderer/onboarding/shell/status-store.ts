import { useEffect } from "react";
import { create } from "zustand";
import type { StepStatus } from "../../../shared/contracts/onboarding";
import type { OnboardingStepId } from "../../../shared/routes";
import type { StepStatuses } from "./model";

interface StatusOverrideStore {
  overrides: StepStatuses;
  set(step: OnboardingStepId, status: StepStatus | null): void;
  reset(): void;
}

export const useStatusOverrides = create<StatusOverrideStore>((set) => ({
  overrides: {},
  set: (step, status) =>
    set((state) => {
      if ((state.overrides[step] ?? null) === status) return state;
      const overrides = { ...state.overrides };
      if (status === null) delete overrides[step];
      else overrides[step] = status;
      return { overrides };
    }),
  reset: () => set({ overrides: {} }),
}));

export function useReportStepStatus(step: OnboardingStepId, status: StepStatus | null): void {
  const setStatus = useStatusOverrides((state) => state.set);
  useEffect(() => {
    setStatus(step, status);
    return () => setStatus(step, null);
  }, [setStatus, step, status]);
}
