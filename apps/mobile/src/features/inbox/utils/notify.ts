import { PushDataSchema, type InboxItem, type InboxKind, type PushData } from "@theone/protocol";

import { INBOX_ROUTE, PUSH_DEVICE_NAME_MAX } from "./constants";
import { isUnread, needsAttention } from "./group";

export type NotifyContext = {
  appState: string;
  pathname: string;
  seen: ReadonlySet<string>;
};

export type PresentContext = {
  remote: boolean;
  appState: string;
  itemId: string | null;
  presented: ReadonlySet<string>;
};

const FINISHED_KINDS: readonly InboxKind[] = ["completed", "failed"];

export const notificationKey = (item: Pick<InboxItem, "id" | "updatedAt">): string => `${item.id}@${item.updatedAt}`;

export const isSharedFile = (item: Pick<InboxItem, "kind" | "readAt">): boolean =>
  item.kind === "file" && isUnread(item);

export const isFinished = (item: Pick<InboxItem, "kind" | "readAt">): boolean =>
  isUnread(item) && FINISHED_KINDS.includes(item.kind);

export function shouldNotify(item: InboxItem | undefined, context: NotifyContext): item is InboxItem {
  if (!item || !(needsAttention(item) || isSharedFile(item) || isFinished(item))) return false;
  if (context.seen.has(notificationKey(item))) return false;
  return context.appState === "active" && context.pathname !== INBOX_ROUTE;
}

export function shouldPresent({ remote, appState, itemId, presented }: PresentContext): boolean {
  if (!remote) return true;
  if (appState === "active") return false;
  return !(itemId && presented.has(itemId));
}

export const isRemoteTrigger = (trigger: unknown): boolean =>
  typeof trigger === "object" && trigger !== null && (trigger as { type?: unknown }).type === "push";

export function parseNotificationData(data: unknown): PushData | null {
  const parsed = PushDataSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function notificationData(item: Pick<InboxItem, "id" | "kind" | "artifactId">, sandboxId: string): PushData {
  return { url: INBOX_ROUTE, sandboxId, itemId: item.id, kind: item.kind, artifactId: item.artifactId };
}

export function pushDeviceName(name: string | null | undefined): string | null {
  const trimmed = name?.trim().slice(0, PUSH_DEVICE_NAME_MAX).trim();
  return trimmed ? trimmed : null;
}
