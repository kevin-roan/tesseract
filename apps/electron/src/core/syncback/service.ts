import type { SyncRequest } from "@tesseract/protocol";
import { ApiError } from "@tesseract/client";
import type { HostChange, SyncBackState, SyncKind, SyncSubmitOptions } from "../../shared/contracts/syncback";
import { createLogger } from "../log";
import type { SyncApi } from "./api";
import { CONFLICT_STATUS, DESKTOP_SOURCE, HEARTBEAT_INTERVAL_MS, NOTIFIED_KINDS, SEEN_LIMIT } from "./constants";
import { NotConfiguredError, describeError } from "./describe";
import { SyncBackError, errorMessage } from "./errors";
import { hostChangeList } from "./get";
import { SYNC_BACK_TITLES } from "./labels";
import { DigestCache } from "./manifest";
import { claimable, handleRequest, type Handled } from "./requests";
import type { Link, SyncState } from "./state";

export type NotifiedKind = (typeof NOTIFIED_KINDS)[number];

export interface SyncBackServiceOptions {
  state: SyncState;
  api: () => SyncApi | null;
  host: string;
  notify(projectId: string, title: string, body: string): void;
  onChange?(state: SyncBackState): void;
  intervalMs?: number;
}

export interface SyncEventLike {
  type: string;
  request?: unknown;
}

const log = createLogger("syncback");

export function notificationKind(request: Partial<Pick<SyncRequest, "kind">>): NotifiedKind {
  const kind = request.kind as string | undefined;
  return (NOTIFIED_KINDS as readonly string[]).includes(kind ?? "") ? (kind as NotifiedKind) : "pull";
}

function isRequest(value: unknown): value is SyncRequest {
  return typeof value === "object" && value !== null && typeof (value as SyncRequest).id === "string";
}

export class SyncBackService {
  private revision = 0;
  private readonly busy = new Set<string>();
  private readonly queue: SyncRequest[] = [];
  private readonly seen = new Set<string>();
  private readonly digests = new Map<string, DigestCache>();
  private active: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private online = false;

  constructor(private readonly options: SyncBackServiceOptions) {}

  get state(): SyncState {
    return this.options.state;
  }

  snapshot(): SyncBackState {
    return { revision: this.revision, busy: [...this.busy] };
  }

  private changed(): void {
    this.options.onChange?.(this.snapshot());
  }

  private bump(): void {
    this.revision += 1;
    this.changed();
  }

  private requireApi(): SyncApi {
    const api = this.options.api();
    if (!api) throw new NotConfiguredError();
    return api;
  }

  setOnline(online: boolean): void {
    this.online = online;
    if (online && this.timer === null) {
      this.timer = setInterval(() => void this.tick(), this.options.intervalMs ?? HEARTBEAT_INTERVAL_MS);
      void this.tick();
    } else if (!online) {
      this.stop();
    }
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  handleEvent(event: SyncEventLike): void {
    if (event.type === "sync.updated") {
      if (isRequest(event.request)) {
        this.bump();
        void this.enqueue(event.request);
      }
    } else if (event.type === "sync.changed") {
      this.bump();
    } else if (event.type === "hello") {
      void this.tick();
    }
  }

  async tick(): Promise<void> {
    if (!this.online) return;
    try {
      await this.enqueueAll(await this.beat());
    } catch (error) {
      log.debug(`sync heartbeat failed: ${describeError(error)}`);
    }
  }

  async beat(): Promise<SyncRequest[]> {
    const api = this.requireApi();
    const links = await this.state.links();
    const projects = [...links.keys()];
    await api.heartbeat({ host: this.options.host, projects, changes: await this.changeCounts(links) });
    return projects.length ? api.pendingRequests() : [];
  }

  private digestsFor(projectId: string): DigestCache {
    let cache = this.digests.get(projectId);
    if (!cache) {
      cache = new DigestCache();
      this.digests.set(projectId, cache);
    }
    return cache;
  }

  private async changeCounts(links: Map<string, Link>): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const [projectId, link] of links) {
      try {
        counts[projectId] = (await hostChangeList(link, this.digestsFor(projectId))).length;
      } catch (error) {
        log.debug(`host changes of ${projectId} unavailable: ${errorMessage(error)}`);
      }
    }
    return counts;
  }

  async hostChanges(projectId: string): Promise<HostChange[]> {
    const link = await this.state.link(projectId);
    if (!link) return [];
    return (await hostChangeList(link, this.digestsFor(projectId))).map(({ path, kind }) => ({ path, kind }));
  }

  async enqueueAll(requests: SyncRequest[]): Promise<void> {
    for (const request of [...requests].reverse()) await this.enqueue(request);
  }

  private remember(id: string): void {
    this.seen.add(id);
    while (this.seen.size > SEEN_LIMIT) this.seen.delete(this.seen.values().next().value as string);
  }

  async enqueue(request: SyncRequest): Promise<void> {
    if (this.seen.has(request.id)) return;
    if (!(await claimable(request, this.state)) || this.seen.has(request.id)) return;
    this.remember(request.id);
    this.queue.push(request);
    this.drain();
  }

  private drain(): void {
    if (this.active || !this.queue.length) return;
    const request = this.queue.shift() as SyncRequest;
    this.busy.add(request.projectId);
    this.changed();
    this.active = this.process(request).finally(() => {
      this.active = null;
      this.busy.delete(request.projectId);
      this.bump();
      this.drain();
    });
  }

  private async process(request: SyncRequest): Promise<void> {
    try {
      this.handled(await handleRequest(this.requireApi(), this.state, request, this.options.host));
    } catch (error) {
      this.failed(request, error);
    }
  }

  private handled(handled: Handled): void {
    const request = handled.request;
    const kind = notificationKind(request);
    const title = SYNC_BACK_TITLES[`${kind}_${handled.ok ? "done" : "failed"}`](request.projectId);
    this.notify(request.projectId, title, handled.message);
  }

  private failed(request: SyncRequest, error: unknown): void {
    if (error instanceof ApiError && error.status === CONFLICT_STATUS) {
      log.debug(`sync request ${request.id} was taken or cancelled: ${error.message}`);
      return;
    }
    if (!(error instanceof ApiError)) this.seen.delete(request.id);
    if (!(error instanceof ApiError) && !(error instanceof SyncBackError)) log.warn(`sync request ${request.id} failed`, error);
    this.notify(request.projectId, SYNC_BACK_TITLES[`${notificationKind(request)}_failed`](request.projectId), describeError(error));
  }

  private notify(projectId: string, title: string, body: string): void {
    try {
      this.options.notify(projectId, title, body);
    } catch (error) {
      log.debug(`could not send a notification: ${errorMessage(error)}`);
    }
  }

  async submit(projectId: string, kind: SyncKind, options: SyncSubmitOptions = {}): Promise<SyncRequest> {
    const body = { kind, force: options.force ?? false, source: DESKTOP_SOURCE, ...(options.paths?.length ? { paths: options.paths } : {}) };
    const request = await this.requireApi().createRequest(projectId, body);
    this.bump();
    await this.enqueue(request);
    return request;
  }

  async idle(): Promise<void> {
    while (this.active) await this.active;
  }
}
