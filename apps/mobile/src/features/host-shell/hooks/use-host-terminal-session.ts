import { useCallback, useEffect, useMemo } from "react";

import type { HeaderAction } from "@/components/screen-header";
import { useWebPageSession } from "@/features/sandbox/hooks/use-web-page-session";
import { PAGE_ACTIONS } from "@/features/sandbox/utils/actions";
import { terminalKindLabel } from "@/features/sandbox/utils/labels";
import { pageTone, stateLabel } from "@/features/sandbox/utils/states";
import { confirm } from "@/lib/confirm";
import { originOf } from "@/lib/url";

import { hostKeys } from "../api/query-keys";
import { useHostSessionStore } from "../store/host-session-store";
import { CLOSE_CONFIRM } from "../utils/content";
import { describeHostError, isSessionLost } from "../utils/errors";
import { useHostClient } from "./use-host-client";
import { useHostNavigation } from "./use-host-navigation";
import { useHostTerminals } from "./use-host-terminals";

export function useHostTerminalSession(terminalId: string) {
  const nav = useHostNavigation();
  const { host, hydrated, session, sessionClient } = useHostClient();
  const clear = useHostSessionStore((state) => state.clear);
  const { terminals, close } = useHostTerminals();
  const terminal = terminals.data?.find((entry) => entry.id === terminalId);

  const target = useMemo(
    () => ({
      key: host && session ? hostKeys.page(host.baseUrl, session.session, terminalId) : hostKeys.root,
      client: sessionClient,
      origin: host ? originOf(host.baseUrl) : null,
    }),
    [host, session, sessionClient, terminalId],
  );
  const page = useWebPageSession("terminal", terminalId, (client) => client.terminalPageUrl(terminalId), sessionClient !== null, undefined, target);

  useEffect(() => {
    if (isSessionLost(page.error)) clear();
  }, [page.error, clear]);

  const { lockScreen } = nav;
  useEffect(() => {
    if (hydrated && !session) lockScreen();
  }, [hydrated, session, lockScreen]);

  const { mutate } = close;
  const closeShell = useCallback(async () => {
    if (await confirm(CLOSE_CONFIRM)) mutate(terminalId, { onSuccess: nav.back });
  }, [mutate, nav, terminalId]);

  const { reconnect } = page;
  const headerActions = useMemo<HeaderAction[]>(
    () => [
      { ...PAGE_ACTIONS.reconnect, onPress: reconnect },
      { ...PAGE_ACTIONS.closeSession, onPress: () => void closeShell(), disabled: close.isPending },
    ],
    [reconnect, closeShell, close.isPending],
  );

  return {
    nav,
    page,
    headerActions,
    title: terminal ? terminal.title || terminalKindLabel(terminal.kind) : "Host shell",
    subtitle: terminal?.cwd ?? host?.name,
    badge: { label: stateLabel(page.connection), tone: pageTone(page.connection) },
    closeError: close.error ? describeHostError(close.error) : null,
  };
}
