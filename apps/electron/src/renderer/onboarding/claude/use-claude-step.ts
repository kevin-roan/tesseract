import { useCallback, useEffect, useMemo, useState } from "react";
import { showToast } from "../../components/Toast";
import { ipc } from "../../lib/ipc";
import { ONBOARDING_TOAST_SCOPE, useOnboardingAction, useOnboardingNavigation, useOnboardingStateQuery } from "../shell";
import { CLAUDE_LABELS } from "./labels";
import { claudeView, isFolderMissing, nextFolderMissing } from "./model";

export function useClaudeStep() {
  const state = useOnboardingStateQuery();
  const nav = useOnboardingNavigation();
  const [folderMissing, setFolderMissing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const { mutate: createDir } = useOnboardingAction(() => ipc.onboarding.claudeCreateDir());
  const check = useOnboardingAction(() => ipc.onboarding.claudeCheck());
  const runCheck = check.mutate;

  const recheck = useCallback(() => {
    runCheck([], {
      onSuccess: (next) => {
        setNow(Date.now());
        setFolderMissing((previous) => nextFolderMissing(previous, next.claude));
        if (isFolderMissing(next.claude)) createDir([]);
      },
    });
  }, [runCheck, createDir]);

  useEffect(() => {
    recheck();
    window.addEventListener("focus", recheck);
    return () => window.removeEventListener("focus", recheck);
  }, [recheck]);

  const accounts = state.data?.claude ?? null;
  const view = useMemo(() => claudeView(accounts, folderMissing, now), [accounts, folderMissing, now]);
  const failed = accounts === null && check.error ? CLAUDE_LABELS.checkFailed(check.error.message) : null;

  const openGuide = useCallback(() => {
    ipc.onboarding
      .openExternal("claude_code_docs")
      .catch((error: Error) => showToast(error.message, { scope: ONBOARDING_TOAST_SCOPE }));
  }, []);

  return {
    view,
    loading: accounts === null && !failed,
    checking: check.isPending,
    failed,
    recheck,
    openGuide,
    back: () => nav.goTo("docker"),
    next: () => nav.goTo("sandbox"),
  };
}
