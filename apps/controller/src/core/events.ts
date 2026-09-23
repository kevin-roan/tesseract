import type { ServerEvent } from "@theone/protocol";
import type { Logger } from "./logger";

export type EventListener = (event: ServerEvent) => void;

export class EventHub {
  private readonly listeners = new Set<EventListener>();

  constructor(private readonly logger: Logger) {}

  publish(event: ServerEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        this.logger.warn("event listener failed", { type: event.type, error });
      }
    }
  }

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
