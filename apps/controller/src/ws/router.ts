import type { Server } from "bun";
import { errorBody, isIdOfKind, routePatterns, TICKET_PARAM, VNC_WS_SUBPROTOCOL, type ErrorCode, type IdKind } from "@tesseract/protocol";
import { HttpError } from "../core/errors";
import type { Services } from "../services";
import { VncBridge } from "../services/vnc-bridge";
import type { WsData, WsRouteKind } from "./types";

export type RouteMatch = { kind: WsRouteKind; id: string | null; idKind: IdKind | null };

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ROUTES = (
  [
    ["events", routePatterns.ws.events, null],
    ["terminal", routePatterns.ws.terminalStream, "terminal"],
    ["processLogs", routePatterns.ws.processLogStream, "process"],
    ["buildLogs", routePatterns.ws.buildLogStream, "build"],
    ["agentRun", routePatterns.ws.agentRunStream, "agentRun"],
    ["vnc", routePatterns.ws.vnc, null],
    ["androidLink", routePatterns.ws.androidLink, null],
    ["androidLinkStream", routePatterns.ws.androidLinkStream, "adbStream"],
  ] as const
).map(([kind, pattern, idKind]) => ({
  kind,
  idKind,
  pattern: new RegExp(`^${escape(pattern).replace(":id", "([^/]+)")}$`),
}));

export function matchWsRoute(pathname: string): RouteMatch | null {
  for (const route of ROUTES) {
    const match = route.pattern.exec(pathname);
    if (!match) continue;
    let id: string | null = null;
    try {
      id = match[1] === undefined ? null : decodeURIComponent(match[1]);
    } catch {
      id = match[1] ?? null;
    }
    return { kind: route.kind, id, idKind: route.idKind };
  }
  return null;
}

export function isWebSocketUpgrade(request: Request): boolean {
  return request.headers.get("upgrade")?.toLowerCase() === "websocket";
}

function fail(code: ErrorCode, message: string, status: number): Response {
  return Response.json(errorBody(code, message), { status });
}

function offersSubprotocol(request: Request, protocol: string): boolean {
  const header = request.headers.get("sec-websocket-protocol") ?? "";
  return header.split(",").some((value) => value.trim() === protocol);
}

function assertTarget(services: Services, match: RouteMatch): void {
  const id = match.id ?? "";
  if (match.idKind && !isIdOfKind(match.idKind, id)) throw new HttpError("not_found", `${match.kind} ${id.slice(0, 80)} not found`);
  switch (match.kind) {
    case "terminal":
      if (!services.terminals.has(id)) throw new HttpError("not_found", `Terminal ${id} not found`);
      return;
    case "processLogs":
      services.processes.get(id);
      return;
    case "buildLogs":
      services.builds.get(id);
      return;
    case "agentRun":
      services.agentRuns.get(id);
      return;
    case "androidLinkStream":
      if (!services.android.hasPendingStream(id)) throw new HttpError("not_found", `ADB stream ${id} not found`);
      return;
    default:
      return;
  }
}

/**
 * Authenticates (one-time ticket), validates the target and upgrades. Returns
 * undefined after a successful upgrade, otherwise an error response.
 */
export async function upgradeWebSocket(
  request: Request,
  server: Server<WsData>,
  services: Services,
  match: RouteMatch,
): Promise<Response | undefined> {
  if (!isWebSocketUpgrade(request)) return fail("bad_request", "WebSocket upgrade required", 400);
  const url = new URL(request.url);
  if (!services.tickets.consume(url.searchParams.get(TICKET_PARAM))) {
    return fail("unauthorized", "Missing, expired or already used ticket", 401);
  }
  let data: WsData;
  const headers: Record<string, string> = {};
  try {
    assertTarget(services, match);
    if (match.kind === "vnc") {
      const bridge = await VncBridge.open(services.config.vncHost, services.config.vncPort);
      data = { kind: "vnc", bridge, cleanup: null };
      if (offersSubprotocol(request, VNC_WS_SUBPROTOCOL)) headers["Sec-WebSocket-Protocol"] = VNC_WS_SUBPROTOCOL;
    } else if (match.kind === "events") {
      data = { kind: "events", cleanup: null };
    } else if (match.kind === "androidLink") {
      data = { kind: "androidLink", session: null, cleanup: null };
    } else {
      data = { kind: match.kind, id: match.id ?? "", cleanup: null };
    }
  } catch (error) {
    if (error instanceof HttpError) return fail(error.code, error.message, error.status);
    throw error;
  }
  const upgraded = Object.keys(headers).length > 0 ? server.upgrade(request, { data, headers }) : server.upgrade(request, { data });
  if (upgraded) return undefined;
  if (data.kind === "vnc") data.bridge.clientClosed();
  return fail("bad_request", "WebSocket upgrade failed", 400);
}
