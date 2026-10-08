import type { TesseractClient } from "@tesseract/client";
import type { SandboxStatus, ServerEventType } from "@tesseract/protocol";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useStore } from "zustand";
import type { ConnectionInput, ConnectionSnapshot, DiscoveryResult } from "../../../shared/contracts/connection";
import { createApiClient } from "../data/client";
import type { ServerEventListener } from "./controller";
import type { MetricsHistory } from "./metrics-history";
import { Poller } from "./poller";
import { connectionController, ensureConnectionRuntime, metricsHistory } from "./runtime";
import type { ConnectionState, InboxCounts } from "./types";
import { connectionView, type ConnectionView } from "./view";

export function useConnectionState<T>(selector: (state: ConnectionState) => T): T {
  const controller = connectionController();
  useEffect(() => {
    ensureConnectionRuntime();
  }, []);
  return useStore(controller.store, selector);
}

const whole = (state: ConnectionState) => state;

export function useConnection(): ConnectionState {
  return useConnectionState(whole);
}

export function useConnectionView(): ConnectionView {
  const state = useConnection();
  return useMemo(() => connectionView(state), [state]);
}

export function useSandboxStatus(): SandboxStatus | null {
  return useConnectionState((state) => state.sandbox);
}

export function useInboxCounts(): InboxCounts {
  return useConnectionState((state) => state.inbox);
}

export function useIsOnline(): boolean {
  return useConnectionState((state) => state.status === "online");
}

export function useWindowVisible(): boolean {
  return useConnectionState((state) => state.windowVisible);
}

export interface ConnectionActions {
  refresh(): void;
  rediscover(): Promise<DiscoveryResult>;
  save(input: ConnectionInput): Promise<ConnectionSnapshot>;
  forget(): Promise<DiscoveryResult>;
}

export function useConnectionActions(): ConnectionActions {
  const controller = connectionController();
  return useMemo(
    () => ({
      refresh: () => controller.refresh(),
      rediscover: () => controller.rediscover(),
      save: (input) => controller.save(input),
      forget: () => controller.forget(),
    }),
    [controller],
  );
}

export function useConnectionClient(): TesseractClient | null {
  const config = useConnectionState((state) => state.config);
  return useMemo(() => (config ? createApiClient(config) : null), [config]);
}

export function useServerEvent<T extends ServerEventType | "*">(type: T, listener: ServerEventListener<T>): void {
  const latest = useRef(listener);
  latest.current = listener;
  useEffect(() => {
    ensureConnectionRuntime();
    return connectionController().subscribe(type, ((event: Parameters<ServerEventListener<T>>[0]) => latest.current(event)) as ServerEventListener<T>);
  }, [type]);
}

export interface UsePollerOptions<T> {
  enabled?: boolean;
  immediate?: boolean;
  hiddenIntervalMs?: number;
  refreshOnVisible?: boolean;
  onResult?(value: T): void;
  onError?(error: unknown): void;
}

export interface PollerHandle {
  loading: boolean;
  refresh(): void;
}

export function usePoller<T>(
  fetch: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
  options: UsePollerOptions<T> = {},
): PollerHandle {
  const { enabled = true, immediate = true, hiddenIntervalMs, refreshOnVisible = false } = options;
  const visible = useWindowVisible();
  const [loading, setLoading] = useState(false);
  const callbacks = useRef({ fetch, onResult: options.onResult, onError: options.onError });
  callbacks.current = { fetch, onResult: options.onResult, onError: options.onError };
  const pollerRef = useRef<Poller<T> | null>(null);
  const interval = visible ? intervalMs : (hiddenIntervalMs ?? intervalMs);
  const intervalRef = useRef(interval);
  intervalRef.current = interval;

  useEffect(() => {
    if (!enabled) return undefined;
    const poller = new Poller<T>({
      fetch: (signal) => callbacks.current.fetch(signal),
      intervalMs: intervalRef.current,
      onResult: (value) => callbacks.current.onResult?.(value),
      onError: (error) => callbacks.current.onError?.(error),
      onLoading: setLoading,
    });
    pollerRef.current = poller;
    poller.start(immediate);
    return () => {
      poller.stop();
      if (pollerRef.current === poller) pollerRef.current = null;
    };
  }, [enabled, immediate]);

  useEffect(() => {
    pollerRef.current?.setInterval(interval);
  }, [interval]);

  useEffect(() => {
    if (visible && refreshOnVisible) pollerRef.current?.refresh();
  }, [visible, refreshOnVisible]);

  return useMemo(() => ({ loading, refresh: () => pollerRef.current?.refresh() }), [loading]);
}

export function useMetricsHistory(): { history: MetricsHistory; revision: number } {
  const history = metricsHistory();
  useEffect(() => {
    ensureConnectionRuntime();
  }, []);
  const revision = useSyncExternalStore(
    (listener) => history.subscribe(listener),
    () => history.revision,
  );
  return { history, revision };
}
