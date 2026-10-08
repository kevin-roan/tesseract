import type { InboxItem, InboxKind, PushData, PushDevice, PushPlatform, RegisterPushDevice } from "@tesseract/protocol";
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
  runDedupeMs?: number;
};

type Json = Record<string, unknown>;

type PushMessage = {
  to: string;
  title: string;
  subtitle?: string;
  body: string;
  sound: "default";
  priority: "high";
  channelId: string;
  data: PushData;
};

const PUSH_KINDS: readonly InboxKind[] = ["completed", "failed", "needs_input", "permission", "file"];
const OUTCOME_KINDS: readonly InboxKind[] = ["completed", "failed"];
const CHUNK_SIZE = 100;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_DEDUPE_MS = 15_000;
const DEFAULT_RUN_DEDUPE_MS = 6 * 60 * 60_000;
/** Every push is titled with the app's name; what happened goes in the subtitle (iOS) or the body (Android). */
export const PUSH_TITLE = "Tesseract";
const CHANNEL_ID = "inbox";

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);

/** iOS shows a subtitle under the title; Android has none, so the heading leads the body there. */
export function pushText(item: Pick<InboxItem, "title" | "body" | "projectId">, platform: PushPlatform): Pick<PushMessage, "title" | "subtitle" | "body"> {
  const heading = item.projectId ? `${item.projectId} · ${item.title}` : item.title;
  if (platform === "ios") return { title: PUSH_TITLE, subtitle: heading, body: item.body };
  return { title: PUSH_TITLE, body: item.body ? `${heading}: ${item.body}` : heading };
}

/** Sends unread inbox items to the registered phones through Expo's push service (FCM on Android, APNs on iOS). */
export class PushService {
  private readonly fetcher: PushFetch;
  private readonly timeoutMs: number;
  private readonly dedupeMs: number;
  private readonly runDedupeMs: number;
  /** Dedupe key → expiry (epoch ms). */
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
    this.runDedupeMs = options.runDedupeMs ?? DEFAULT_RUN_DEDUPE_MS;
  }

  register(input: RegisterPushDevice): PushDevice {
    const now = nowIso();
    return this.repos.savePushDevice({
      token: input.token,
      platform: input.platform,
      name: input.name ?? null,
      deviceId: input.deviceId ?? null,
      createdAt: now,
      updatedAt: now,
    });
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
   * one item for the Stop hook(s) and the run's end, so the outcome of an agent run is pushed once
   * (within `runDedupeMs`); any other item pushed within `dedupeMs` is skipped.
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
    for (const [key, until] of this.recent) if (now >= until) this.recent.delete(key);
    const perRun = item.agentRunId !== null && OUTCOME_KINDS.includes(item.kind);
    const runKey = perRun ? `${item.id}:${item.agentRunId}` : null;
    if (this.recent.has(item.id) || (runKey !== null && this.recent.has(runKey))) return false;
    this.recent.set(item.id, now + this.dedupeMs);
    if (runKey !== null) this.recent.set(runKey, now + this.runDedupeMs);
    return true;
  }

  private async send(item: InboxItem): Promise<void> {
    const url = this.config.push.url;
    const devices = this.repos.pushDevices();
    if (url === null || devices.length === 0) return;
    const data: PushData = { url: "/inbox", sandboxId: this.config.sandboxId, itemId: item.id, kind: item.kind, artifactId: item.artifactId };
    const messages: PushMessage[] = devices.map((device) => ({
      to: device.token,
      ...pushText(item, device.platform),
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
