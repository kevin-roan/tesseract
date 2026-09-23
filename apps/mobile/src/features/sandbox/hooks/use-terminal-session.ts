import { useCallback, useMemo } from "react";

import type { HeaderAction } from "@/components/screen-header";
import { confirm } from "@/lib/confirm";

import { PAGE_ACTIONS } from "../utils/actions";
import { describeError } from "../utils/errors";
import { terminalKindLabel } from "../utils/labels";
import { pageTone, stateLabel } from "../utils/states";
import { useCloseTerminal } from "./use-sandbox-mutations";
import { useSandboxNavigation } from "./use-sandbox-navigation";
import { useTerminals } from "./use-sandbox-queries";
import { useWebPageSession } from "./use-web-page-session";

export function useTerminalSession(terminalId: string) {
  const nav = useSandboxNavigation();
  const terminals = useTerminals();
  const terminal = terminals.data?.find((entry) => entry.id === terminalId);
  const session = useWebPageSession("terminal", terminalId, (client) => client.terminalPageUrl(terminalId));
  const closeTerminal = useCloseTerminal();
  const { mutate } = closeTerminal;
  const { reconnect } = session;

  const close = useCallback(async () => {
    const confirmed = await confirm({
      title: "Close this session?",
      message: "Programs running in it are stopped. Leaving the screen instead keeps the session alive.",
      confirmLabel: "Close session",
      destructive: true,
    });
    if (confirmed) mutate(terminalId, { onSuccess: nav.back });
  }, [mutate, nav, terminalId]);

  const headerActions = useMemo<HeaderAction[]>(
    () => [
      { ...PAGE_ACTIONS.reconnect, onPress: reconnect },
      { ...PAGE_ACTIONS.closeSession, onPress: () => void close(), disabled: closeTerminal.isPending },
    ],
    [reconnect, close, closeTerminal.isPending],
  );

  return {
    nav,
    session,
    headerActions,
    title: terminal ? terminal.title || terminalKindLabel(terminal.kind) : "Terminal",
    subtitle: terminal?.cwd,
    badge: { label: stateLabel(session.connection), tone: pageTone(session.connection) },
    closeError: closeTerminal.error ? describeError(closeTerminal.error) : null,
  };
}
