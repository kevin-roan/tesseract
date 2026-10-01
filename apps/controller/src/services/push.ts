import type { InboxItem, InboxKind, PushData, PushDevice, RegisterPushDevice } from "@theone/protocol";
import type { Config } from "../config";
import { notFound } from "../core/errors";
import type { EventHub } from "../core/events";
import type { Logger } from "../core/logger";
import { nowIso } from "../core/time";
import type { Repositories } from "../db/repositories";

export type PushFetch = (url: string, init: RequestInit) => Promise<Response>;

export type PushOptions = {
  fetch?: PushFetch;
  timeoutMs?: number;
  dedupeMs?: number;
};

type Json = Record<string, unknown>;

type PushMessage = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  priority: "high";
  channelId: string;
  data: PushData;
};

const PUSH_KINDS: readonly InboxKind[] = ["completed", "failed", "needs_input", "permission", "file"];
const CHUNK_SIZE = 100;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_DEDUPE_MS = 15_000;
const CHANNEL_ID = "inbox";

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);

/** Sends unread inbox items to the registered phones through Expo's push service (FCM on Android, APNs on iOS). */
export class PushService {
  private readonly fetcher: PushFetch;
  private readonly timeoutMs: number;
  private readonly dedupeMs: number;
  private readonly recent = new Map<string, number>();

  constructor(
    private readonly config: Config,
    private readonly repos: Repositories,
    private readonly logger: Logger,
    options: PushOptions = {},
  ) {
    this.fetcher = options.fetch ?? ((url, init) => fetch(url, init));
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.dedupeMs = options.dedupeMs ?? DEFAULT_DEDUPE_MS;
  }

  register(input: RegisterPushDevice): PushDevice {
    const now = nowIso();
    return this.repos.savePushDevice({ token: input.token, platform: input.platform, name: input.name ?? null, createdAt: now, updatedAt: now });
  }

  unregister(token: string): PushDevice {
    const device = this.repos.deletePushDevices([token])[0];
    if (!device) throw notFound("Push device not found");
    return device;
  }

  list(): PushDevice[] {
    return this.repos.pushDevices();
  }

  /**
   * Pushes unread `completed`, `failed`, `needs_input`, `permission` and `file` items. The inbox bumps
   * one item for both the Stop hook and the run's end, so an item pushed within `dedupeMs` is skipped.
   */
  follow(hub: EventHub): () => void {
    return hub.subscribe((event) => {
      if (event.type !== "inbox.updated" || !event.item || !this.shouldPush(event.item)) return;
      void this.send(event.item);
    });
  }

  private shouldPush(item: InboxItem): boolean {
    if (this.config.push.url === null || item.readAt !== null || !PUSH_KINDS.includes(item.kind)) return false;
    const now = Date.now();
    for (const [id, at] of this.recent) if (now - at >= this.dedupeMs) this.recent.delete(id);
    if (this.recent.has(item.id)) return false;
    this.recent.set(item.id, now);
    return true;
  }

  private async send(item: InboxItem): Promise<void> {
    const url = this.config.push.url;
    const tokens = this.repos.pushDevices().map((device) => device.token);
    if (url === null || tokens.length === 0) return;
    const data: PushData = { url: "/inbox", sandboxId: this.config.sandboxId, itemId: item.id, kind: item.kind, artifactId: item.artifactId };
    const messages: PushMessage[] = tokens.map((to) => ({
      to,
      title: item.title,
      body: item.body,
      sound: "default",
      priority: "high",
      channelId: CHANNEL_ID,
      data,
    }));
    for (let start = 0; start < messages.length; start += CHUNK_SIZE) {
      await this.post(url, messages.slice(start, start + CHUNK_SIZE));
    }
  }

  private async post(url: string, messages: PushMessage[]): Promise<void> {
    const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
    if (this.config.push.accessToken) headers.Authorization = `Bearer ${this.config.push.accessToken}`;
    try {
      const response = await this.fetcher(url, {
        method: "POST",
        headers,
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const body = (await response.json().catch(() => null)) as unknown;
      if (!response.ok || !isObject(body) || !Array.isArray(body.data)) {
        this.logger.warn("push request failed", { status: response.status, errors: isObject(body) ? body.errors : undefined });
        return;
      }
      this.handleTickets(messages, body.data);
    } catch (error) {
      this.logger.warn("push service unreachable", { error });
    }
  }

  private handleTickets(messages: PushMessage[], tickets: unknown[]): void {
    const gone: string[] = [];
    tickets.forEach((ticket, index) => {
      if (!isObject(ticket) || ticket.status !== "error") return;
      const details = isObject(ticket.details) ? ticket.details : {};
      const token = typeof details.expoPushToken === "string" ? details.expoPushToken : messages[index]?.to;
      if (details.error === "DeviceNotRegistered" && token) gone.push(token);
      else this.logger.warn("push rejected", { error: details.error, message: ticket.message });
    });
    const removed = this.repos.deletePushDevices(gone);
    if (removed.length > 0) this.logger.info("removed unregistered push devices", { count: removed.length });
  }
}
