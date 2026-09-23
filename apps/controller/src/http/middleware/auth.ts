import type { MiddlewareHandler } from "hono";
import { errorBody, routePatterns, TICKET_PARAM } from "@theone/protocol";
import type { TicketStore } from "../../auth/tickets";
import { tokensEqual } from "../../auth/token";

const BEARER = /^Bearer\s+(\S+)\s*$/i;
const ARTIFACT_DOWNLOAD = new RegExp(`^${routePatterns.rest.artifactDownload.replace(":id", "[^/]+")}$`);

export function bearerToken(header: string | undefined | null): string | null {
  return BEARER.exec(header ?? "")?.[1] ?? null;
}

export function isAuthorized(header: string | undefined | null, token: string): boolean {
  const presented = bearerToken(header);
  return presented !== null && tokensEqual(presented, token);
}

/** Bearer auth for every /v1 route except GET /v1/health; artifact downloads also accept a one-time ticket. */
export function requireAuth(token: string, tickets: TicketStore): MiddlewareHandler {
  return async (c, next) => {
    const path = c.req.path;
    if (c.req.method === "GET" && path === routePatterns.rest.health) return next();
    if (isAuthorized(c.req.header("authorization"), token)) return next();
    if (c.req.method === "GET" && ARTIFACT_DOWNLOAD.test(path) && tickets.consume(c.req.query(TICKET_PARAM))) return next();
    c.header("WWW-Authenticate", 'Bearer realm="theone"');
    return c.json(errorBody("unauthorized", "Missing or invalid credentials"), 401);
  };
}
