import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { DEFAULT_PAGE, ROUTE } from "../../../shared/routes";
import { runtime } from "../../app/runtime";
import { showToast } from "../../components/Toast";
import { ipc } from "../../lib/ipc";
import { ONBOARDING_STATE_KEY, ONBOARDING_TOAST_SCOPE, useOnboardingStateQuery } from "../shell";
import { DEFAULT_AUTOSTART, FAILURE_TOAST_MS } from "./constants";
import { DONE_LABELS } from "./labels";
import { summarize } from "./model";

export function useDoneStep() {
  const state = useOnboardingStateQuery();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [autostart, setAutostart] = useState(DEFAULT_AUTOSTART);
  const items = useMemo(() => summarize(state.data), [state.data]);

  const finish = useMutation({
    mutationFn: async (sandboxAutostart: boolean) => {
      const next = await ipc.onboarding.finish(sandboxAutostart);
      client.setQueryData(ONBOARDING_STATE_KEY, next);
      await ipc.window.openMain().catch(() => undefined);
      return next;
    },
    onSuccess: () => {
      if (runtime.windowKind !== "onboarding") navigate(ROUTE.page(DEFAULT_PAGE));
    },
    onError: (error: Error) =>
      showToast(DONE_LABELS.finishFailed(error.message), {
        scope: ONBOARDING_TOAST_SCOPE,
        timeoutMs: FAILURE_TOAST_MS,
      }),
  });

  return {
    items,
    autostart,
    setAutostart,
    finish: () => finish.mutate(autostart),
    finishing: finish.isPending,
  };
}
