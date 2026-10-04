import { useCallback, useState } from "react";
import { Linking } from "react-native";
import type { AppRun } from "@theone/protocol";

import { useHostNavigation } from "@/features/host-shell/hooks/use-host-navigation";
import { useCopyText } from "@/features/onboarding/hooks/use-copy-text";
import { useActiveSandbox } from "@/features/sandbox/hooks/use-sandbox-client";
import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";

import { openPlanFor } from "../utils/runs";
import { useAppRunAction } from "./use-app-run-mutations";

export type DeeplinkFailure = { runId: string; manifestUrl: string };

export function useOpenAppRun() {
  const sandboxNav = useSandboxNavigation();
  const hostNav = useHostNavigation();
  const sandbox = useActiveSandbox();
  const { mutate: runAction } = useAppRunAction();
  const [failure, setFailure] = useState<DeeplinkFailure | null>(null);
  const copy = useCopyText(failure?.manifestUrl ?? "");

  const open = useCallback(
    (run: AppRun, title: string) => {
      const plan = openPlanFor(run);
      if (!plan) return;
      setFailure((current) => (current?.runId === run.id ? null : current));
      switch (plan.kind) {
        case "preview":
          if (sandbox) sandboxNav.preview(sandbox.id, run.id, title);
          return;
        case "deeplink":
          void Linking.openURL(plan.url).catch(() => setFailure({ runId: run.id, manifestUrl: plan.manifestUrl }));
          return;
        case "display":
          if (plan.focus) runAction({ runId: run.id, action: "focus" });
          sandboxNav.display();
          return;
        case "android":
          hostNav.android();
          return;
      }
    },
    [sandbox, sandboxNav, hostNav, runAction],
  );

  return {
    open,
    failureFor: (runId: string): DeeplinkFailure | null => (failure?.runId === runId ? failure : null),
    copy,
  };
}
