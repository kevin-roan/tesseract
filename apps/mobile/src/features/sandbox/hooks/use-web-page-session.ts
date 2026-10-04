import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { computeBackoffDelay, type TheOneClient } from "@theone/client";
import type { VncAction } from "@theone/protocol";

import type { WebSurfaceHandle } from "@/components/web-surface/types";

import type { PageConnection, PageKind } from "../types";
import { PAGE_RECONNECT_DELAY_MS, PAGE_RECONNECT_LIMIT, PAGE_TERMINATE_LIMIT } from "../utils/constants";
import {
  isDroppedPageState,
  pageConnectionFor,
  parsePageMessage,
  reconnectMessage,
  reconnectScript,
} from "../utils/web-bridge";
import { useSandboxClient } from "./use-sandbox-client";
import { usePageUrl, type PageTarget } from "./use-page-url";

type SessionState = { url: string | null; connection: PageConnection; exitCode: number | null | undefined };

type SessionPatch = Partial<Omit<SessionState, "url">>;

type RetryState = { attempts: number; timer: ReturnType<typeof setTimeout> | null; dropped: boolean; terminations: number };

export function useWebPageSession(
  page: PageKind,
  id: string | null,
  build: (client: TheOneClient) => Promise<string>,
  enabled = true,
  onAction?: (action: VncAction) => void,
  target?: PageTarget,
) {
  const active = useSandboxClient();
  const client = target ? target.client : active.client;
  const pageUrl = usePageUrl(page, id, build, enabled, target);
  const surfaceRef = useRef<WebSurfaceHandle>(null);
  const retry = useRef<RetryState>({ attempts: 0, timer: null, dropped: false, terminations: 0 });
  const actionHandler = useRef(onAction);
  const [session, setSession] = useState<SessionState>({ url: null, connection: "loading", exitCode: undefined });
  const current =
    session.url === pageUrl.url ? session : { url: pageUrl.url, connection: "loading" as const, exitCode: undefined };
  const { refresh } = pageUrl;
  const url = pageUrl.url;

  const update = useCallback(
    (patch: SessionPatch | ((previous: SessionState) => SessionPatch)) =>
      setSession((previous) => {
        const base: SessionState = previous.url === url ? previous : { url, connection: "loading", exitCode: undefined };
        return { ...base, ...(typeof patch === "function" ? patch(base) : patch) };
      }),
    [url],
  );

  const sendTicket = useCallback(
    (onTicketError: () => void) => {
      if (!client) return;
      client
        .createTicket()
        .then(({ ticket }) => {
          const surface = surfaceRef.current;
          const delivered = surface?.run(reconnectScript(ticket)) || surface?.post(reconnectMessage(ticket));
          if (!delivered) refresh();
        })
        .catch(onTicketError);
    },
    [client, refresh],
  );

  const cancelRetry = useCallback(() => {
    const state = retry.current;
    if (state.timer !== null) clearTimeout(state.timer);
    state.timer = null;
  }, []);

  const scheduleReconnect = useCallback(
    function schedule() {
      const state = retry.current;
      if (state.timer !== null || state.attempts >= PAGE_RECONNECT_LIMIT) return;
      const delay = computeBackoffDelay(state.attempts, PAGE_RECONNECT_DELAY_MS);
      state.attempts += 1;
      state.timer = setTimeout(() => {
        state.timer = null;
        sendTicket(schedule);
      }, delay);
    },
    [sendTicket],
  );

  const resume = useCallback(() => {
    cancelRetry();
    retry.current.attempts = 0;
    sendTicket(scheduleReconnect);
  }, [cancelRetry, sendTicket, scheduleReconnect]);

  useEffect(() => {
    const state = retry.current;
    return () => {
      if (state.timer !== null) clearTimeout(state.timer);
      state.timer = null;
      state.attempts = 0;
      state.dropped = false;
    };
  }, [url]);

  useEffect(() => {
    actionHandler.current = onAction;
  }, [onAction]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (appState) => {
      if (appState === "active" && retry.current.dropped) resume();
    });
    return () => subscription.remove();
  }, [resume]);

  const handleMessage = useCallback(
    (raw: string) => {
      const message = parsePageMessage(raw, page);
      if (!message) return;
      if (message.kind === "action") return actionHandler.current?.(message.action);
      const state = retry.current;
      if (message.kind === "state") {
        const connection = pageConnectionFor(message.state);
        state.dropped = isDroppedPageState(message.state);
        if (connection === "connected") {
          state.attempts = 0;
          state.terminations = 0;
        }
        if (state.dropped) scheduleReconnect();
        return update({ connection });
      }
      if (message.kind === "exit") {
        state.dropped = false;
        cancelRetry();
        return update({ connection: "exited", exitCode: message.code });
      }
      cancelRetry();
      state.attempts = 0;
      sendTicket(refresh);
    },
    [page, update, scheduleReconnect, cancelRetry, sendTicket, refresh],
  );

  const handleLoad = useCallback(
    () => update(({ connection }) => ({ connection: connection === "loading" ? "connecting" : connection })),
    [update],
  );

  const handleError = useCallback(() => update({ connection: "disconnected" }), [update]);

  /** WebKit killed the page's content process; rebuild it a limited number of times before waiting for the user. */
  const handleTerminate = useCallback(() => {
    const state = retry.current;
    cancelRetry();
    state.terminations += 1;
    if (state.terminations > PAGE_TERMINATE_LIMIT) return update({ connection: "disconnected" });
    refresh();
  }, [cancelRetry, refresh, update]);

  const reconnect = useCallback(() => {
    retry.current.terminations = 0;
    refresh();
  }, [refresh]);

  return {
    url,
    origin: pageUrl.origin,
    error: pageUrl.error,
    isLoading: pageUrl.isLoading,
    connection: current.connection,
    exitCode: current.exitCode,
    surfaceRef,
    handleMessage,
    handleLoad,
    handleError,
    handleTerminate,
    reconnect,
  };
}
