import type { ServerEventOf } from "@tesseract/protocol";

export type InboxEvent = ServerEventOf<"inbox.updated">;

type Listener = (sandboxId: string, event: InboxEvent) => void;

const listeners = new Set<Listener>();

export function subscribeInboxEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitInboxEvent(sandboxId: string, event: InboxEvent): void {
  for (const listener of listeners) listener(sandboxId, event);
}
