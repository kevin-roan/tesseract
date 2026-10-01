import type { Server } from "bun";
import { errorBody, LIMITS, routePatterns } from "@theone/protocol";
import type { Config } from "./config";
import { createApp, MAX_BODY_BYTES } from "./http/app";
import { createServices, type ServiceOptions, type Services } from "./services";
import { createWebSocketHandler } from "./ws/handlers";
import { matchWsRoute, isWebSocketUpgrade, upgradeWebSocket } from "./ws/router";
import { EVENTS_TOPIC, type WsData } from "./ws/types";
import terminalPage from "./ui/terminal.html";
import vncPage from "./ui/vnc.html";

export type ControllerOptions = ServiceOptions & {
  pingIntervalMs?: number;
  wsBackpressureLimitBytes?: number;
};

export type Controller = {
  server: Server<WsData>;
  services: Services;
  url: URL;
  stop: () => Promise<void>;
};

const PING_MESSAGE = JSON.stringify({ type: "ping" });
const HTTP_IDLE_TIMEOUT_SEC = 60;

export function startController(config: Config, options: ControllerOptions = {}): Controller {
  const services = createServices(config, options);
  const app = createApp(services);
  const logger = services.logger;

  const server: Server<WsData> = Bun.serve({
    hostname: config.host,
    port: config.port,
    development: false,
    idleTimeout: HTTP_IDLE_TIMEOUT_SEC,
    maxRequestBodySize: Math.max(MAX_BODY_BYTES, LIMITS.maxClaudeImportBytes, LIMITS.maxUploadBodyBytes, LIMITS.maxProjectSyncBytes) * 2,
    routes: {
      [routePatterns.ui.terminal]: terminalPage,
      [routePatterns.ui.vnc]: vncPage,
    },
    fetch(request, bunServer) {
      const match = matchWsRoute(new URL(request.url).pathname);
      const plainEventsRequest = match?.kind === "events" && !isWebSocketUpgrade(request) && request.method !== "GET";
      if (match && !plainEventsRequest) return upgradeWebSocket(request, bunServer, services, match);
      return app.fetch(request, bunServer);
    },
    websocket: createWebSocketHandler(services, options.wsBackpressureLimitBytes),
    error(error) {
      logger.error("server error", { error });
      return Response.json(errorBody("internal", "Internal error"), { status: 500 });
    },
  });

  const offHub = services.hub.subscribe((event) => server.publish(EVENTS_TOPIC, JSON.stringify(event)));
  const ping = setInterval(() => server.publish(EVENTS_TOPIC, PING_MESSAGE), options.pingIntervalMs ?? LIMITS.eventsPingIntervalMs);

  let stopping: Promise<void> | null = null;
  const stop = () => {
    stopping ??= (async () => {
      clearInterval(ping);
      void server.stop(false);
      await services.close();
      offHub();
      await server.stop(true);
    })();
    return stopping;
  };

  const url = new URL(server.url.href);
  services.ports.ignore(Number(url.port));
  logger.info("controller listening", {
    url: url.href,
    workspace: config.workspace,
    sandbox: config.sandboxId,
    version: services.version,
  });
  return { server, services, url, stop };
}
