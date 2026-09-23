import type { StreamConnection } from "@theone/client";
import type { ServerEvent } from "@theone/protocol";
import { client, SECONDS } from "./env";

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor<T>(
  label: string,
  probe: () => Promise<T | undefined | null | false> | T | undefined | null | false,
  timeoutMs = 30 * SECONDS,
  intervalMs = 500,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const value = await probe();
      if (value !== undefined && value !== null && value !== false) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }
  const reason = lastError instanceof Error ? `: ${lastError.message}` : "";
  throw new Error(`timed out after ${timeoutMs} ms waiting for ${label}${reason}`);
}

export interface EventRecorder {
  readonly events: ServerEvent[];
  next<T extends ServerEvent>(label: string, match: (event: ServerEvent) => event is T, timeoutMs?: number): Promise<T>;
  next(label: string, match: (event: ServerEvent) => boolean, timeoutMs?: number): Promise<ServerEvent>;
  close(): void;
}

export async function recordEvents(): Promise<EventRecorder> {
  const events: ServerEvent[] = [];
  let connection: StreamConnection | undefined;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("no hello on the events socket")), 20 * SECONDS);
    connection = client.openEvents({
      onEvent: (event) => {
        events.push(event);
        if (event.type === "hello") {
          clearTimeout(timer);
          resolve();
        }
      },
    });
  });
  return {
    events,
    next: (label: string, match: (event: ServerEvent) => boolean, timeoutMs = 30 * SECONDS) =>
      waitFor(`event ${label}`, () => events.find(match), timeoutMs, 100),
    close: () => connection?.close(),
  };
}
