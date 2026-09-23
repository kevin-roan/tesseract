import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { API_PREFIX, errorBody, errorCodeForStatus } from "@theone/protocol";
import { HttpError } from "../core/errors";
import type { Services } from "../services";
import { requireAuth } from "./middleware/auth";
import { redactUrl, requestLog } from "./middleware/request-log";
import { registerAgentRoutes } from "./routes/agent";
import { registerArtifactRoutes } from "./routes/artifacts";
import { registerBuildRoutes } from "./routes/builds";
import { registerProcessRoutes } from "./routes/processes";
import { registerProjectRoutes } from "./routes/projects";
import { registerSystemRoutes } from "./routes/system";
import { registerTerminalRoutes } from "./routes/terminals";

export const MAX_BODY_BYTES = 1024 * 1024;

export function createApp(services: Services): Hono {
  const { config, logger } = services;
  const app = new Hono();
  const api = `${API_PREFIX}/*`;
  const anyOrigin = config.corsOrigins.includes("*");

  app.use("*", requestLog(logger.child("http")));
  app.get("/favicon.ico", (c) => c.body(null, 204));
  app.use(
    api,
    cors({
      origin: anyOrigin ? "*" : config.corsOrigins,
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type"],
      exposeHeaders: ["Content-Disposition", "X-Content-SHA256"],
      maxAge: 600,
    }),
  );
  app.use(
    api,
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json(errorBody("bad_request", "Request body exceeds 1 MiB"), 413),
    }),
  );
  app.use(api, requireAuth(services.token, services.tickets));

  registerSystemRoutes(app, services);
  registerProjectRoutes(app, services);
  registerProcessRoutes(app, services);
  registerTerminalRoutes(app, services);
  registerBuildRoutes(app, services);
  registerArtifactRoutes(app, services);
  registerAgentRoutes(app, services);

  app.notFound((c) => c.json(errorBody("not_found", `No route for ${c.req.method} ${c.req.path}`), 404));

  app.onError((error, c) => {
    if (error instanceof HttpError) {
      return c.json(errorBody(error.code, error.message), error.status as ContentfulStatusCode);
    }
    if (error instanceof HTTPException) {
      const status = error.status as ContentfulStatusCode;
      return c.json(errorBody(errorCodeForStatus(status), error.message || "Request failed"), status);
    }
    logger.error("unhandled request error", { method: c.req.method, path: redactUrl(new URL(c.req.url)), error });
    return c.json(errorBody("internal", "Internal error"), 500);
  });

  return app;
}
