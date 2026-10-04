import type { Server, ServerWebSocket } from "bun";
import {
  CreateTerminalSchema,
  errorBody,
  HOST_SHELL_SERVICE,
  HostLockSchema,
  HostUnlockSchema,
  isIdOfKind,
  parseJson,
  parseJsonWith,
  PROTOCOL_VERSION,
  restPaths,
  routePatterns,
  TerminalClientMessageSchema,
  TICKET_PARAM,
  validate,
  type HostHealth,
  type Schema,
  type TerminalServerMessage,
} from "@theone/protocol";
import { TicketStore } from "../auth/tickets";
import { badRequest, errorMessage, HttpError, notFound } from "../core/errors";
import { createLogger, type Logger } from "../core/logger";
import terminalPage from "../ui/terminal.html";
import { VERSION } from "../version";
import { HostAuth, type HostAuthOptions } from "./auth";
import type { HostConfig } from "./config";
import { HostStateStore } from "./state";
import { HostTerminals } from "./terminals";

type WsData = { id: string; cleanup: (() => void) | null };

export type HostShellOptions = HostAuthOptions & { logger?: Logger; stopGraceMs?: number };

export type HostShell = {
  server: Server<WsData>;
  url: URL;
  auth: HostAuth;
  terminals: HostTerminals;
  stop: () => Promise<void>;
};

const MAX_BODY_BYTES = 64 * 1024;
const MAX_CLIENT_MESSAGE_BYTES = 1024 * 1024;
const BACKPRESSURE_LIMIT_BYTES = 16 * 1024 * 1024;
const NORMAL_CLOSURE = 1000;
const INTERNAL_ERROR = 1011;
const HTTP_IDLE_TIMEOUT_SEC = 60;

const TERMINAL_PATH = new RegExp(`^${routePatterns.rest.terminal.replace(":id", "([^/]+)")}$`);
const STREAM_PATH = new RegExp(`^${routePatterns.ws.terminalStream.replace(":id", "([^/]+)")}$`);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function respond(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

function fail(error: HttpError): Response {
  const headers: Record<string, string> = { ...CORS_HEADERS };
  if (error.code === "unauthorized") headers["WWW-Authenticate"] = 'Bearer realm="theone-host"';
  return Response.json(errorBody(error.code, error.message), { status: error.status, headers });
}

function decodeId(match: RegExpExecArray | null): string | null {
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

async function readBody<T>(request: Request, schema: Schema<T>): Promise<T> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw badRequest("Request body too large");
  const parsed = parseJson(text);
  if (!parsed.ok) throw badRequest(`Request body must be JSON: ${parsed.error.message}`);
  const result = validate(schema, parsed.value);
  if (!result.ok) throw badRequest(`Invalid request body: ${result.error.message}`);
  return result.value;
}

export function startHostShell(config: HostConfig, options: HostShellOptions = {}): HostShell {
  const logger = options.logger ?? createLogger("info", "host-shell");
  const store = new HostStateStore(config.stateDir, config.stateFile);
  store.ensureToken();
  const auth = new HostAuth(store, logger, options);
  const tickets = new TicketStore();
  const terminals = new HostTerminals(config.shell, config.home, logger, undefined, options.stopGraceMs);
  const health: HostHealth = { ok: true, service: HOST_SHELL_SERVICE, version: VERSION, protocolVersion: PROTOCOL_VERSION, hostId: config.hostId };

  async function route(request: Request, server: Server<WsData>): Promise<Response | undefined> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const authorization = request.headers.get("authorization");

    if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (path === restPaths.health() && method === "GET") return respond(health);

    const streamId = decodeId(STREAM_PATH.exec(path));
    if (streamId !== null) {
      if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") throw badRequest("WebSocket upgrade required");
      if (!tickets.consume(url.searchParams.get(TICKET_PARAM))) throw new HttpError("unauthorized", "Missing, expired or already used ticket");
      if (!isIdOfKind("terminal", streamId) || !terminals.has(streamId)) throw notFound(`Terminal ${streamId.slice(0, 80)} not found`);
      if (server.upgrade(request, { data: { id: streamId, cleanup: null } })) return undefined;
      throw badRequest("WebSocket upgrade failed");
    }

    if (path === restPaths.hostLock() && method === "GET") return respond(auth.status(auth.requireToken(authorization)));
    if (path === restPaths.hostUnlock() && method === "POST") {
      auth.requireToken(authorization);
      const body = await readBody(request, HostUnlockSchema);
      return respond(await auth.unlock(authorization, body.pin, server.requestIP(request)?.address ?? null));
    }
    if (path === restPaths.hostLock() && method === "POST") {
      auth.requireToken(authorization);
      const body = await readBody(request, HostLockSchema);
      auth.lock(authorization, body.session);
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const terminalId = decodeId(TERMINAL_PATH.exec(path));
    const known = path === restPaths.authTicket() || path === restPaths.terminals() || terminalId !== null;
    if (!known) throw notFound(`No route for ${method} ${path}`);
    auth.requireSession(authorization);

    if (path === restPaths.authTicket() && method === "POST") return respond(tickets.issue());
    if (path === restPaths.terminals() && method === "GET") return respond(terminals.list());
    if (path === restPaths.terminals() && method === "POST") return respond(terminals.create(await readBody(request, CreateTerminalSchema)), 201);
    if (terminalId !== null && method === "DELETE") {
      if (!isIdOfKind("terminal", terminalId)) throw notFound(`Terminal ${terminalId.slice(0, 80)} not found`);
      return respond(await terminals.close(terminalId));
    }
    throw new HttpError("bad_request", `${method} is not supported on ${path}`, 405);
  }

  const send = (ws: ServerWebSocket<WsData>, message: TerminalServerMessage) => ws.send(JSON.stringify(message));

  const server: Server<WsData> = Bun.serve<WsData>({
    hostname: config.bind,
    port: config.port,
    development: false,
    idleTimeout: HTTP_IDLE_TIMEOUT_SEC,
    routes: { [routePatterns.ui.terminal]: terminalPage },
    async fetch(request, bunServer) {
      try {
        return await route(request, bunServer);
      } catch (error) {
        if (error instanceof HttpError) return fail(error);
        logger.error("request failed", { error: errorMessage(error) });
        return fail(new HttpError("internal", "Internal error"));
      }
    },
    websocket: {
      maxPayloadLength: MAX_CLIENT_MESSAGE_BYTES,
      backpressureLimit: BACKPRESSURE_LIMIT_BYTES,
      closeOnBackpressureLimit: true,
      perMessageDeflate: false,
      sendPings: true,
      open(ws) {
        try {
          ws.data.cleanup = terminals.attach(ws.data.id, {
            send: (message) => send(ws, message),
            close: () => ws.close(NORMAL_CLOSURE, "terminal exited"),
          });
        } catch {
          ws.close(INTERNAL_ERROR, "stream unavailable");
        }
      },
      message(ws, message) {
        if (typeof message !== "string") return;
        const parsed = parseJsonWith(TerminalClientMessageSchema, message);
        if (!parsed.ok) return;
        if (parsed.value.type === "input") terminals.write(ws.data.id, parsed.value.data);
        else terminals.resize(ws.data.id, parsed.value.cols, parsed.value.rows);
      },
      close(ws) {
        ws.data.cleanup?.();
        ws.data.cleanup = null;
      },
    },
  });

  let stopping: Promise<void> | null = null;
  const stop = () => {
    stopping ??= (async () => {
      void server.stop(false);
      await terminals.shutdown();
      await server.stop(true);
    })();
    return stopping;
  };

  const url = new URL(server.url.href);
  logger.info("host shell listening", { url: url.href, host: config.hostId, state: config.stateFile });
  return { server, url, auth, terminals, stop };
}
