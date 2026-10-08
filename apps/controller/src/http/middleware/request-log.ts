import type { MiddlewareHandler } from "hono";
import { TICKET_PARAM } from "@tesseract/protocol";
import type { Logger } from "../../core/logger";

const SECRET_PARAMS = new Set<string>([TICKET_PARAM, "token"]);

export function redactUrl(url: URL): string {
  if (!url.search) return url.pathname;
  const params = new URLSearchParams(url.search);
  for (const key of [...params.keys()]) {
    if (SECRET_PARAMS.has(key)) params.set(key, "redacted");
  }
  return `${url.pathname}?${params.toString()}`;
}

export function requestLog(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const started = performance.now();
    await next();
    const status = c.res.status;
    const fields = {
      status,
      ms: Math.round(performance.now() - started),
    };
    const line = `${c.req.method} ${redactUrl(new URL(c.req.url))}`;
    if (status >= 500) logger.warn(line, fields);
    else logger.debug(line, fields);
  };
}
