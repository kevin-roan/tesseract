import { useCallback, useEffect, useMemo } from "react";
import { copyText } from "../../components/CopyButton";
import { showToast } from "../../components/Toast";
import { ipc } from "../../lib/ipc";
import { ONBOARDING_TOAST_SCOPE, useOnboardingAction, useOnboardingNavigation, useOnboardingStateQuery } from "../shell";
import { REACHABILITY_FOCUS_SEARCH } from "./constants";
import { PAIR_STEP_LABELS } from "./labels";
import { pairView } from "./model";

export function usePairStep() {
  const state = useOnboardingStateQuery();
  const nav = useOnboardingNavigation();
  const load = useOnboardingAction(() => ipc.onboarding.pairLoad());
  const runLoad = load.mutate;

  const reload = useCallback(() => runLoad([]), [runLoad]);

  useEffect(() => {
    reload();
  }, [reload]);

  const pair = state.data?.pair ?? null;
  const view = useMemo(
    () => pairView(pair, load.error?.message ?? null, load.isPending),
    [pair, load.error, load.isPending],
  );

  const copy = useCallback((link: string) => {
    void copyText(link).then((ok) => {
      if (ok) showToast(PAIR_STEP_LABELS.copied, { scope: ONBOARDING_TOAST_SCOPE });
    });
  }, []);

  return {
    view,
    reload,
    copy,
    changeReachability: () => nav.goTo("sandbox", REACHABILITY_FOCUS_SEARCH),
    back: () => nav.goTo("android"),
    skip: nav.skip,
    next: () => nav.goTo("finish"),
  };
}
