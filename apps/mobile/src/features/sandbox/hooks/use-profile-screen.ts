import { useMemo } from "react";
import { isApiError } from "@tesseract/client";

import { useClaudeAccountEntry } from "@/features/claude-account/hooks/use-claude-account-entry";

import { useSandboxStore } from "../store/sandbox-store";
import { describeError } from "../utils/errors";
import { ACTIVITY_COPY } from "../utils/profile-content";
import { isTailscaleIdentityMissing, profileStats, profileView, sandboxChoices } from "../utils/profile";
import { useSandboxClient } from "./use-sandbox-client";
import { useSandboxNavigation } from "./use-sandbox-navigation";
import { useSandboxProblems } from "./use-sandbox-problems";
import { useSandboxIdentity, useSandboxStatus } from "./use-sandbox-queries";
import { useSandboxRefresh } from "./use-sandbox-refresh";

export function useProfileScreen() {
  const nav = useSandboxNavigation();
  const { sandbox, hydrated } = useSandboxClient();
  const sandboxes = useSandboxStore((state) => state.sandboxes);
  const activeId = useSandboxStore((state) => state.activeId);
  const selectSandbox = useSandboxStore((state) => state.setActive);
  const identity = useSandboxIdentity();
  const status = useSandboxStatus();
  const claude = useClaudeAccountEntry();
  const problems = useSandboxProblems(status.error);
  const { refreshing, refresh } = useSandboxRefresh();

  const sandboxRows = useMemo(() => sandboxChoices(sandboxes, activeId), [sandboxes, activeId]);

  const identityNotFound = isApiError(identity.error, "not_found");

  return {
    nav,
    hydrated,
    sandbox,
    profile: sandbox ? profileView(identity.data, sandbox, status.data) : null,
    stats: profileStats(status.data),
    sandboxes: sandboxRows,
    selectSandbox,
    pairSandbox: nav.pair,
    tailscaleMissing: isTailscaleIdentityMissing(identity.data) || identityNotFound,
    identityError: identity.error && !identityNotFound && !problems.issue ? describeError(identity.error) : null,
    retryIdentity: () => void identity.refetch(),
    missingToken: problems.missingToken,
    issue: problems.issue,
    repair: problems.repair,
    statusError: problems.error,
    retryStatus: () => void status.refetch(),
    claudeAccountTitle: claude.title,
    claudeAccount: claude.subtitle,
    openClaudeAccount: claude.open,
    activity: { title: ACTIVITY_COPY.title, subtitle: ACTIVITY_COPY.subtitle, open: nav.activity },
    refreshing,
    refresh,
  };
}
