import type { AgentRunHandlers, RequestOptions, StreamConnection, StreamOptions } from "@theone/client";
import type { AgentRun, AgentRunDetail, AgentRunEvent } from "@theone/protocol";
import { addEvents, EMPTY_EVENT_LOG, type EventLog } from "../timeline/model";
import { isFinal } from "../timeline/run-info";
import { FEED_POLL_INTERVAL_MS, FEED_STREAM_OPTIONS } from "./constants";

export type LinkState = "idle" | "loading" | "live" | "reconnecting" | "polling";

export interface FeedClient {
  getAgentRun(id: string, options?: RequestOptions): Promise<AgentRunDetail>;
  openAgentRun(id: string, handlers: AgentRunHandlers, options?: StreamOptions): StreamConnection;
}

export interface FeedTimers {
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface FeedSnapshot {
  runId: string | null;
  run: AgentRun | null;
  log: EventLog;
  link: LinkState;
  error: string | null;
}

export interface RunFeedOptions {
  describeError(error: unknown): string;
  canStream?: () => boolean;
  timers?: FeedTimers;
  pollIntervalMs?: number;
  onRun?: (run: AgentRun) => void;
}

const browserTimers: FeedTimers = {
  setInterval: (callback, ms) => globalThis.setInterval(callback, ms),
  clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof globalThis.setInterval>),
};

export function stripEvents(detail: AgentRun | AgentRunDetail): AgentRun {
  if (!("events" in detail)) return detail;
  const { events: _events, ...run } = detail;
  return run;
}

export function mergeRun(current: AgentRun | null, incoming: AgentRun): AgentRun | null {
  if (current && isFinal(current) && incoming.state === "running") return null;
  const merged = current ? { ...current, ...incoming } : incoming;
  return current && JSON.stringify(current) === JSON.stringify(merged) ? null : merged;
}

export class RunFeed {
  private snapshot: FeedSnapshot = { runId: null, run: null, log: EMPTY_EVENT_LOG, link: "idle", error: null };
  private readonly listeners = new Set<() => void>();
  private generation = 0;
  private client: FeedClient | null = null;
  private socket: StreamConnection | null = null;
  private pollHandle: unknown = null;
  private abort: AbortController | null = null;
  private wasOpen = false;
  private readonly timers: FeedTimers;
  private readonly pollIntervalMs: number;

  constructor(private readonly options: RunFeedOptions) {
    this.timers = options.timers ?? browserTimers;
    this.pollIntervalMs = options.pollIntervalMs ?? FEED_POLL_INTERVAL_MS;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): FeedSnapshot => this.snapshot;

  get active(): boolean {
    return this.socket !== null || this.pollHandle !== null || this.abort !== null;
  }

  setClient(client: FeedClient | null): void {
    if (client === this.client) return;
    const wasActive = this.active;
    this.halt();
    this.client = client;
    if (wasActive) this.resume();
  }

  select(runId: string | null, run: AgentRun | null = null): void {
    this.halt();
    this.set({ runId, run: run && run.id === runId ? run : null, log: EMPTY_EVENT_LOG, link: "idle", error: null });
  }

  resume(): void {
    const { runId, run } = this.snapshot;
    if (runId === null || this.active || this.client === null) return;
    if (run?.state === "running") this.openStream();
    else this.fetch();
  }

  reload(): void {
    this.halt();
    this.set({ error: null });
    this.fetch();
  }

  stop(): void {
    this.halt();
    this.set({ link: "idle" });
  }

  updateRun(run: AgentRun): void {
    if (run.id !== this.snapshot.runId) return;
    const merged = mergeRun(this.snapshot.run, run);
    if (merged) this.set({ run: merged });
  }

  private halt(): void {
    this.generation += 1;
    this.socket?.close();
    this.socket = null;
    if (this.pollHandle !== null) this.timers.clearInterval(this.pollHandle);
    this.pollHandle = null;
    this.abort?.abort();
    this.abort = null;
    this.wasOpen = false;
  }

  private set(changes: Partial<FeedSnapshot>): void {
    const next = { ...this.snapshot, ...changes };
    const keys = Object.keys(changes) as (keyof FeedSnapshot)[];
    if (keys.every((key) => Object.is(next[key], this.snapshot[key]))) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }

  private guard<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
    const generation = this.generation;
    return (...args) => {
      if (generation === this.generation) fn(...args);
    };
  }

  private applyRun(run: AgentRun): void {
    const stripped = stripEvents(run);
    if (stripped.id !== this.snapshot.runId) return;
    const merged = this.snapshot.run ? { ...this.snapshot.run, ...stripped } : stripped;
    this.set({ run: merged, error: null });
    this.options.onRun?.(merged);
  }

  private applyEvents(events: readonly AgentRunEvent[]): void {
    this.set({ log: addEvents(this.snapshot.log, events) });
  }

  private applyDetail(detail: AgentRunDetail): void {
    this.applyEvents(detail.events ?? []);
    this.applyRun(detail);
  }

  private fetch(): void {
    const { runId } = this.snapshot;
    const client = this.client;
    if (runId === null || client === null) return;
    this.set({ link: "loading" });
    const abort = new AbortController();
    this.abort = abort;
    const done = this.guard(() => {
      this.abort = null;
    });
    client.getAgentRun(runId, { signal: abort.signal }).then(
      this.guard((detail: AgentRunDetail) => {
        done();
        this.applyDetail(detail);
        if (this.snapshot.run?.state === "running") this.openStream();
        else this.set({ link: "idle" });
      }),
      this.guard((error: unknown) => {
        done();
        this.set({ link: "idle", error: this.options.describeError(error) });
      }),
    );
  }

  private openStream(): void {
    const { runId } = this.snapshot;
    const client = this.client;
    if (runId === null || client === null) return;
    if (this.options.canStream && !this.options.canStream()) {
      this.startPolling();
      return;
    }
    this.set({ link: "loading" });
    try {
      this.socket = client.openAgentRun(
        runId,
        {
          onEvent: this.guard((event: AgentRunEvent) => this.applyEvents([event])),
          onRun: this.guard((run: AgentRun) => this.applyRun(run)),
          onStateChange: this.guard((state: string) => {
            if (state === "open") {
              this.wasOpen = true;
              this.set({ link: "live" });
            } else if (state === "connecting") {
              this.set({ link: this.wasOpen ? "reconnecting" : "loading" });
            }
          }),
          onClose: this.guard((info: { willReconnect: boolean }) => {
            if (info.willReconnect) {
              this.set({ link: "reconnecting" });
              return;
            }
            this.socket = null;
            this.wasOpen = false;
            this.fetch();
          }),
        },
        FEED_STREAM_OPTIONS,
      );
    } catch {
      this.socket = null;
      this.startPolling();
    }
  }

  private startPolling(): void {
    const { runId } = this.snapshot;
    const client = this.client;
    if (runId === null || client === null) return;
    this.set({ link: "polling" });
    let inFlight = false;
    const poll = this.guard(() => {
      if (inFlight) return;
      inFlight = true;
      client.getAgentRun(runId).then(
        this.guard((detail: AgentRunDetail) => {
          inFlight = false;
          this.applyDetail(detail);
          if (isFinal(this.snapshot.run) && this.pollHandle !== null) {
            this.timers.clearInterval(this.pollHandle);
            this.pollHandle = null;
            this.set({ link: "idle" });
          }
        }),
        () => {
          inFlight = false;
        },
      );
    });
    this.pollHandle = this.timers.setInterval(poll, this.pollIntervalMs);
    poll();
  }
}
