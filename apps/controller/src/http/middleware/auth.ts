import type { MiddlewareHandler } from "hono";
import { errorBody, routePatterns, TICKET_PARAM } from "@tesseract/protocol";
import type { TicketStore } from "../../auth/tickets";
import { tokensEqual } from "../../auth/token";

const BEARER = /^Bearer\s+(\S+)\s*$/i;
const TICKET_DOWNLOADS = [routePatterns.rest.artifactDownload, routePatterns.rest.buildOutputDownload, routePatterns.rest.projectFileDownload, routePatterns.rest.uploadContent].map(
  (pattern) => new RegExp(`^${pattern.replace(":id", "[^/]+")}$`),
);

export function bearerToken(header: string | undefined | null): string | null {
  return BEARER.exec(header ?? "")?.[1] ?? null;
}

export function isAuthorized(header: string | undefined | null, token: string): boolean {
  const presented = bearerToken(header);
  return presented !== null && tokensEqual(presented, token);
}

/** Bearer auth for every /v1 route except GET /v1/health; artifact, build output and project file downloads and upload content also accept a one-time ticket. */
export function requireAuth(token: string, tickets: TicketStore): MiddlewareHandler {
  return async (c, next) => {
    const path = c.req.path;
    if (c.req.method === "GET" && path === routePatterns.rest.health) return next();
    if (isAuthorized(c.req.header("authorization"), token)) return next();
    if (c.req.method === "GET" && TICKET_DOWNLOADS.some((pattern) => pattern.test(path)) && tickets.consume(c.req.query(TICKET_PARAM))) return next();
    c.header("WWW-Authenticate", 'Bearer realm="tesseract"');
    return c.json(errorBody("unauthorized", "Missing or invalid credentials"), 401);
  };
}
