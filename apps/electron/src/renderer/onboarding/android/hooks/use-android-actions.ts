import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { InstallPlan } from "../../../../shared/contracts/android";
import type { OnboardingState } from "../../../../shared/contracts/onboarding";
import { ipc } from "../../../lib/ipc";
import { ONBOARDING_STATE_KEY } from "../../shell";
import { ACCEL_DOCS_URL } from "../constants";

export interface AndroidActions {
  install(plan: InstallPlan): void;
  useExisting(sdkRoot: string, avd: string): void;
  acceptLicenses(ids: readonly string[]): void;
  cancel(): void;
  openAccelDocs(): void;
  busy: boolean;
  error: string | null;
}

async function acceptAll(ids: readonly string[]): Promise<OnboardingState | null> {
  let state: OnboardingState | null = null;
  for (const id of ids) state = await ipc.onboarding.androidAcceptLicense(id);
  return state;
}

export function useAndroidActions(): AndroidActions {
  const client = useQueryClient();
  const store = useCallback(
    (state: OnboardingState | null) => {
      if (state) client.setQueryData(ONBOARDING_STATE_KEY, state);
    },
    [client],
  );
  const installMutation = useMutation({ mutationFn: (plan: InstallPlan) => ipc.onboarding.androidInstall(plan), onSuccess: store });
  const existingMutation = useMutation({
    mutationFn: ({ sdkRoot, avd }: { sdkRoot: string; avd: string }) => ipc.onboarding.androidUseExisting(sdkRoot, avd),
    onSuccess: store,
  });
  const licenseMutation = useMutation({ mutationFn: acceptAll, onSuccess: store });
  const cancelMutation = useMutation({ mutationFn: () => ipc.onboarding.androidCancel(), onSuccess: store });
  const failure = installMutation.error ?? existingMutation.error ?? licenseMutation.error ?? cancelMutation.error;

  return {
    install: installMutation.mutate,
    useExisting: (sdkRoot, avd) => existingMutation.mutate({ sdkRoot, avd }),
    acceptLicenses: licenseMutation.mutate,
    cancel: () => cancelMutation.mutate(),
    openAccelDocs: () => {
      ipc.onboarding.openExternal(ACCEL_DOCS_URL).catch(() => undefined);
    },
    busy: installMutation.isPending || existingMutation.isPending || licenseMutation.isPending || cancelMutation.isPending,
    error: failure ? (failure instanceof Error ? failure.message : String(failure)) : null,
  };
}
