import type { SocketCloseEvent, SocketLike, SocketMessageEvent } from "@theone/client";
import { socketFixtures } from "./registry";

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 3;

export class FixtureSocket implements SocketLike {
  readyState = CONNECTING;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: SocketMessageEvent) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event: SocketCloseEvent) => void) | null = null;

  constructor(url: string) {
    const parsed = new URL(url);
    const route = socketFixtures.find((candidate) =>
      typeof candidate.path === "string" ? candidate.path === parsed.pathname : candidate.path.test(parsed.pathname),
    );
    queueMicrotask(() => {
      if (this.readyState !== CONNECTING) return;
      this.readyState = OPEN;
      this.onopen?.({});
      for (const frame of route?.frames(parsed) ?? []) {
        this.onmessage?.({ data: typeof frame === "string" ? frame : JSON.stringify(frame) });
      }
    });
  }

  send(): void {}

  close(code = 1000, reason = ""): void {
    if (this.readyState === CLOSED) return;
    this.readyState = CLOSED;
    this.onclose?.({ code, reason });
  }
}
