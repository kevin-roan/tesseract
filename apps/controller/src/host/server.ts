import type { Server, ServerWebSocket } from "bun";
import {
  AndroidScreenClientMessageSchema,
  AndroidScreenQuerySchema,
  CreateHostTerminalSchema,
  errorBody,
  HOST_SHELL_SERVICE,
  HostLockSchema,
  HostUnlockSchema,
  isIdOfKind,
  LinkSandboxSchema,
  parseJson,
  parseJsonWith,
  PROTOCOL_VERSION,
  restPaths,
  routePatterns,
  StartEmulatorSchema,
  TerminalClientMessageSchema,
  TICKET_PARAM,
  UpdateAndroidStreamSchema,
  validate,
  wsPaths,
  type AndroidScreenServerMessage,
  type HostHealth,
  type Schema,
  type TerminalServerMessage,
} from "@tesseract/protocol";
import { TicketStore } from "../auth/tickets";
import { badRequest, errorMessage, HttpError, notFound } from "../core/errors";
import { createLogger, type Logger } from "../core/logger";
import androidPage from "../ui/android.html";
import terminalPage from "../ui/terminal.html";
import { VERSION } from "../version";
import { HostAndroid, type HostAndroidOptions } from "./android";
import type { ScreenClient, ScreenRequest } from "./android/screen";
import { HostAuth, type HostAuthOptions } from "./auth";
import type { HostConfig } from "./config";
import { HostStateStore } from "./state";
import { HostTerminals } from "./terminals";

type WsData = { kind: "terminal" | "screen"; id: string; request: ScreenRequest; screen: ScreenClient | null; cleanup: (() => void) | null };

export type HostShellOptions = HostAuthOptions & { logger?: Logger; stopGraceMs?: number; android?: HostAndroidOptions };

export type HostShell = {
  server: Server<WsData>;
  url: URL;
  auth: HostAuth;
  terminals: HostTerminals;
  android: HostAndroid;
  /** Settles once a running emulator was adopted and the stored sandbox link dialled. */
  ready: Promise<void>;
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
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function respond(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

function fail(error: HttpError): Response {
  const headers: Record<string, string> = { ...CORS_HEADERS };
  if (error.code === "unauthorized") headers["WWW-Authenticate"] = 'Bearer realm="tesseract-host"';
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
  const android = new HostAndroid(config.android, store, { hostId: config.hostId, version: VERSION }, logger, options.android);
  const ready = android.init().catch((error: unknown) => logger.error("android init failed", { error: errorMessage(error) }));
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
      if (server.upgrade(request, { data: { kind: "terminal", id: streamId, request: {}, screen: null, cleanup: null } })) return undefined;
      throw badRequest("WebSocket upgrade failed");
    }

    if (path === wsPaths.androidScreen()) {
      if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") throw badRequest("WebSocket upgrade required");
      const query = validate(AndroidScreenQuerySchema, {
        ticket: url.searchParams.get(TICKET_PARAM),
        maxSize: url.searchParams.get("maxSize") ?? undefined,
        serial: url.searchParams.get("serial") ?? undefined,
        codec: url.searchParams.get("codec") ?? undefined,
      });
      if (!query.ok) throw badRequest(`Invalid query: ${query.error.message}`);
      if (!tickets.consume(query.value.ticket)) throw new HttpError("unauthorized", "Missing, expired or already used ticket");
      const { ticket: _ticket, ...screen } = query.value;
      if (server.upgrade(request, { data: { kind: "screen", id: "screen", request: screen, screen: null, cleanup: null } })) return undefined;
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
    const androidPaths: string[] = [restPaths.android(), restPaths.androidEmulator(), restPaths.androidLink(), restPaths.androidDevices(), restPaths.androidStream()];
    const androidPath = androidPaths.includes(path);
    const known = path === restPaths.authTicket() || path === restPaths.terminals() || terminalId !== null || androidPath;
    if (!known) throw notFound(`No route for ${method} ${path}`);
    auth.requireSession(authorization);

    if (path === restPaths.authTicket() && method === "POST") return respond(tickets.issue());
    if (path === restPaths.terminals() && method === "GET") return respond(terminals.list());
    if (path === restPaths.terminals() && method === "POST") return respond(terminals.create(await readBody(request, CreateHostTerminalSchema)), 201);
    if (terminalId !== null && method === "DELETE") {
      if (!isIdOfKind("terminal", terminalId)) throw notFound(`Terminal ${terminalId.slice(0, 80)} not found`);
      return respond(await terminals.close(terminalId));
    }
    if (path === restPaths.android() && method === "GET") return respond(await android.status());
    if (path === restPaths.androidEmulator() && method === "POST") return respond(await android.start(await readBody(request, StartEmulatorSchema)), 202);
    if (path === restPaths.androidEmulator() && method === "DELETE") return respond(android.stop());
    if (path === restPaths.androidLink() && method === "POST") return respond(android.linkSandbox(await readBody(request, LinkSandboxSchema)));
    if (path === restPaths.androidLink() && method === "DELETE") return respond(android.unlinkSandbox());
    if (path === restPaths.androidDevices() && method === "GET") return respond(await android.devices());
    if (path === restPaths.androidStream() && method === "GET") return respond(android.streamSettings());
    if (path === restPaths.androidStream() && method === "PUT") return respond(android.updateStream(await readBody(request, UpdateAndroidStreamSchema)));
    throw new HttpError("bad_request", `${method} is not supported on ${path}`, 405);
  }

  const send = (ws: ServerWebSocket<WsData>, message: TerminalServerMessage | AndroidScreenServerMessage) => ws.send(JSON.stringify(message));

  function openScreen(ws: ServerWebSocket<WsData>): void {
    const client: ScreenClient = {
      send: (message) => send(ws, message),
      sendFrame: (frame) => ws.send(frame),
      bufferedAmount: () => ws.getBufferedAmount(),
      close: (code, reason) => ws.close(code, reason),
    };
    ws.data.screen = client;
    ws.data.cleanup = android.screens.attach(client, ws.data.request);
  }

  const server: Server<WsData> = Bun.serve<WsData>({
    hostname: config.bind,
    port: config.port,
    development: false,
    idleTimeout: HTTP_IDLE_TIMEOUT_SEC,
    routes: { [routePatterns.ui.terminal]: terminalPage, [routePatterns.ui.android]: androidPage },
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
        if (ws.data.kind === "screen") {
          openScreen(ws);
          return;
        }
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
        if (ws.data.kind === "screen") {
          const parsed = parseJsonWith(AndroidScreenClientMessageSchema, message);
          if (parsed.ok && ws.data.screen) android.screens.handle(ws.data.screen, parsed.value);
          return;
        }
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
      await Promise.all([terminals.shutdown(), android.shutdown()]);
      await server.stop(true);
    })();
    return stopping;
  };

  const url = new URL(server.url.href);
  logger.info("host shell listening", { url: url.href, host: config.hostId, state: config.stateFile });
  return { server, url, auth, terminals, android, ready, stop };
}
