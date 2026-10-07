import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { OnboardingState } from "../../../../shared/contracts/onboarding";
import type { BuildMode, SetupChoices } from "../../../../shared/contracts/sandbox";
import { showToast, TOAST_TIMEOUT_MS } from "../../../components/Toast";
import { ipc } from "../../../lib/ipc";
import { ONBOARDING_STATE_KEY, ONBOARDING_TOAST_SCOPE } from "../../shell";

export interface StartRequest {
  choices: SetupChoices;
  mode: BuildMode;
}

function failureToast(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  showToast(message, {
    scope: ONBOARDING_TOAST_SCOPE,
    timeoutMs: TOAST_TIMEOUT_MS.failure,
  });
}

export function useBuildActions() {
  const client = useQueryClient();
  const store = (state: OnboardingState) => client.setQueryData(ONBOARDING_STATE_KEY, state);
  const start = useMutation({
    mutationFn: async ({ choices, mode }: StartRequest) => {
      store(await ipc.onboarding.sandboxSave(choices));
      return ipc.onboarding.buildStart(mode);
    },
    onSuccess: store,
    onError: failureToast,
  });
  const adopt = useMutation({
    mutationFn: () => ipc.onboarding.sandboxAdopt(),
    onSuccess: store,
    onError: failureToast,
  });
  const cancel = useMutation({
    mutationFn: () => ipc.onboarding.buildCancel(),
    onSuccess: store,
    onError: failureToast,
  });
  const openTailscaleKeys = () => {
    ipc.onboarding.openExternal("tailscale_keys").catch(failureToast);
  };
  return { start, adopt, cancel, openTailscaleKeys };
}
