import { ProtocolVersionError, type StreamConnection, type TheOneClient } from "@theone/client";
import { normalizeBaseUrl, type Health, type SandboxStatus, type ServerEvent, type ServerEventOf, type ServerEventType } from "@theone/protocol";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { Unsubscribe } from "../../../shared/contracts/common";
import type {
  ConnectionConfig,
  ConnectionInput,
  ConnectionSnapshot,
  DiscoveryResult,
} from "../../../shared/contracts/connection";
import {
  INBOX_LIMIT,
  INITIAL_CONNECTION_STATE,
  SLOW_POLL_STATUSES,
  STATUS_INTERVAL_HIDDEN_MS,
  STATUS_INTERVAL_MS,
} from "./constants";
import { describeError, statusForError } from "./describe-error";
import { ERROR_MESSAGES } from "./labels";
import { Poller, type PollerTimers } from "./poller";
import type { ConnectionState, EventsStatus, InboxCounts } from "./types";

export interface ConnectionDeps {
  load(): Promise<ConnectionSnapshot>;
  save(input: ConnectionInput): Promise<ConnectionSnapshot>;
  forget(): Promise<ConnectionSnapshot>;
  discover(): Promise<DiscoveryResult>;
  onChanged(listener: (snapshot: ConnectionSnapshot) => void): Unsubscribe;
  createClient(config: ConnectionConfig): TheOneClient | null;
  now?(): number;
  timers?: PollerTimers;
}

export type ServerEventListener<T extends ServerEventType | "*"> = (
  event: T extends ServerEventType ? ServerEventOf<T> : ServerEvent,
) => void;

type AnyListener = (event: ServerEvent) => void;

const STREAM_STATES: Record<string, EventsStatus> = { connecting: "connecting", open: "open", closed: "closed" };

export function sameConnection(a: ConnectionConfig | null, b: ConnectionConfig | null): boolean {
  if (!a || !b) return a === b;
  return a.apiUrl === b.apiUrl && a.token === b.token && (a.name ?? null) === (b.name ?? null) && (a.pairingUrl ?? null) === (b.pairingUrl ?? null);
}

function stable<T>(previous: T | null, next: T): T {
  return previous !== null && JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
}

function inboxCounts(value: Partial<InboxCounts>): InboxCounts {
  return { unreadCount: value.unreadCount ?? 0, attentionCount: value.attentionCount ?? 0 };
}

export class ConnectionController {
  readonly store: StoreApi<ConnectionState> = createStore<ConnectionState>(() => INITIAL_CONNECTION_STATE);
  private client: TheOneClient | null = null;
  private stream: StreamConnection | null = null;
  private streamToken: object | null = null;
  private readonly poller: Poller<[Health, SandboxStatus]>;
  private readonly listeners = new Map<ServerEventType | "*", Set<AnyListener>>();
  private stopChanged: Unsubscribe | null = null;
  private started: Promise<void> | null = null;
  private discoverySeq = 0;
  private quiet = 0;

  constructor(private readonly deps: ConnectionDeps) {
    this.poller = new Poller({
      fetch: (signal) => this.check(signal),
      intervalMs: STATUS_INTERVAL_MS,
      onResult: (value) => this.checked(value),
      onError: (error) => this.checkFailed(error),
      timers: deps.timers,
    });
  }

  get state(): ConnectionState {
    return this.store.getState();
  }

  get currentClient(): TheOneClient | null {
    return this.client;
  }

  start(): Promise<void> {
    this.started ??= this.boot();
    return this.started;
  }

  stop(): void {
    this.poller.stop();
    this.stopEvents();
    this.stopChanged?.();
    this.stopChanged = null;
    this.discoverySeq += 1;
    this.started = null;
  }

  connect(config: ConnectionConfig): void {
    this.poller.stop();
    this.stopEvents();
    const invalid = !normalizeBaseUrl(config.apiUrl)
      ? ERROR_MESSAGES.invalidUrl(config.apiUrl)
      : !config.token.trim()
        ? ERROR_MESSAGES.tokenRequired
        : null;
    const client = invalid ? null : this.deps.createClient(config);
    this.client = client;
    if (!client) {
      this.set({ status: "offline", config, health: null, errorMessage: invalid ?? ERROR_MESSAGES.invalidUrl(config.apiUrl), checkedAt: this.now() });
      return;
    }
    this.set({ status: "connecting", config, health: null, sandbox: null, errorMessage: null, checkedAt: null });
    this.poller.setInterval(this.interval());
    this.poller.start();
  }

  refresh(): void {
    if (this.client) this.poller.refresh();
  }

  async save(input: ConnectionInput): Promise<ConnectionSnapshot> {
    this.discoverySeq += 1;
    const snapshot = await this.quietly(() => this.deps.save(input));
    this.set({ configFile: snapshot.configFile });
    if (snapshot.config && !sameConnection(snapshot.config, this.state.config)) this.connect(snapshot.config);
    else if (snapshot.config) {
      this.set({ config: snapshot.config });
      this.refresh();
    }
    return snapshot;
  }

  async forget(): Promise<DiscoveryResult> {
    const snapshot = await this.quietly(() => this.deps.forget());
    this.set({ configFile: snapshot.configFile });
    return this.rediscover();
  }

  async rediscover(): Promise<DiscoveryResult> {
    const seq = (this.discoverySeq += 1);
    const previous = this.state;
    this.set({ status: "discovering", errorMessage: null });
    const result = await this.quietly(() =>
      this.deps.discover().catch((error: unknown): DiscoveryResult => ({ ok: false, error: describeError(error) })),
    );
    if (seq !== this.discoverySeq) return result;
    if (result.ok) this.connect(result.config);
    else if (previous.config) this.connect(previous.config);
    else this.set({ status: "unconfigured", errorMessage: result.error, checkedAt: this.now() });
    return result;
  }

  setWindowVisible(visible: boolean): void {
    if (this.state.windowVisible === visible) return;
    this.set({ windowVisible: visible });
    this.poller.setInterval(this.interval());
    if (visible) this.refresh();
  }

  subscribe<T extends ServerEventType | "*">(type: T, listener: ServerEventListener<T>): Unsubscribe {
    const set = this.listeners.get(type) ?? new Set<AnyListener>();
    set.add(listener as AnyListener);
    this.listeners.set(type, set);
    return () => {
      set.delete(listener as AnyListener);
    };
  }

  private async boot(): Promise<void> {
    this.stopChanged = this.deps.onChanged((snapshot) => this.changed(snapshot));
    let snapshot: ConnectionSnapshot | null = null;
    try {
      snapshot = await this.deps.load();
    } catch {
      snapshot = null;
    }
    if (snapshot) this.set({ configFile: snapshot.configFile });
    if (snapshot?.config) this.connect(snapshot.config);
    else await this.rediscover();
  }

  private changed(snapshot: ConnectionSnapshot): void {
    this.set({ configFile: snapshot.configFile });
    if (this.quiet > 0 || this.state.status === "discovering") return;
    const next = snapshot.config;
    if (!next) {
      if (this.state.config) void this.rediscover();
      return;
    }
    if (sameConnection(next, this.state.config)) this.set({ config: next });
    else this.connect(next);
  }

  private async quietly<T>(operation: () => Promise<T>): Promise<T> {
    this.quiet += 1;
    try {
      return await operation();
    } finally {
      this.quiet -= 1;
    }
  }

  private async check(signal: AbortSignal): Promise<[Health, SandboxStatus]> {
    const client = this.client;
    if (!client) throw new Error(ERROR_MESSAGES.notConfiguredInternal);
    const [health, status] = await Promise.allSettled([client.health({ signal }), client.status({ signal })]);
    if (health.status === "rejected") throw health.reason;
    if (status.status === "rejected") throw status.reason;
    return [health.value, status.value];
  }

  private checked([health, sandbox]: [Health, SandboxStatus]): void {
    const state = this.state;
    const wasOnline = state.status === "online";
    this.set({
      status: "online",
      health: stable(state.health, health),
      sandbox: stable(state.sandbox, sandbox),
      errorMessage: null,
      checkedAt: this.now(),
    });
    this.poller.setInterval(this.interval());
    if (!wasOnline) {
      this.startEvents();
      this.refreshInbox();
    }
  }

  private checkFailed(error: unknown): void {
    const state = this.state;
    const status = statusForError(error);
    if (state.status === "online") this.stopEvents();
    this.set({ status, errorMessage: describeError(error), checkedAt: this.now() });
    if (SLOW_POLL_STATUSES.includes(status)) this.poller.setInterval(STATUS_INTERVAL_HIDDEN_MS);
  }

  private interval(): number {
    return this.state.windowVisible ? STATUS_INTERVAL_MS : STATUS_INTERVAL_HIDDEN_MS;
  }

  private startEvents(): void {
    const client = this.client;
    if (!client) return;
    this.stopEvents();
    const token = {};
    const current = () => this.streamToken === token;
    this.streamToken = token;
    try {
      this.stream = client.openEvents({
        onEvent: (event) => {
          if (current()) this.dispatch(event);
        },
        onStateChange: (state) => {
          if (current() && this.state.events !== "incompatible") this.set({ events: STREAM_STATES[state] ?? "closed" });
        },
        onError: (error) => {
          if (!current() || !(error instanceof ProtocolVersionError)) return;
          this.checkFailed(error);
          this.set({ events: "incompatible" });
        },
      });
    } catch {
      this.stream = null;
      this.streamToken = null;
      this.set({ events: "unavailable" });
    }
  }

  private stopEvents(): void {
    const stream = this.stream;
    this.stream = null;
    this.streamToken = null;
    stream?.close();
    if (this.state.events !== "idle") this.set({ events: "idle" });
  }

  private dispatch(event: ServerEvent): void {
    if (event.type === "inbox.updated") this.set({ inbox: inboxCounts(event) });
    if (event.type === "hello") this.refreshInbox();
    for (const key of [event.type, "*"] as const) {
      this.listeners.get(key)?.forEach((listener) => listener(event));
    }
  }

  private refreshInbox(): void {
    const client = this.client;
    if (!client) return;
    client
      .inbox({ limit: INBOX_LIMIT })
      .then((inbox) => {
        if (this.client === client) this.set({ inbox: inboxCounts(inbox) });
      })
      .catch(() => undefined);
  }

  private set(patch: Partial<ConnectionState>): void {
    this.store.setState(patch);
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now();
  }
}
