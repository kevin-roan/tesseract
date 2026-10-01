import type { Context } from "hono";

type TimeoutControl = { timeout?: (request: Request, seconds: number) => void };

/** For requests that can outlast the server's idle timeout (transcriptions, project syncs). */
export function disableIdleTimeout(c: Context): void {
  (c.env as TimeoutControl | undefined)?.timeout?.(c.req.raw, 0);
}
