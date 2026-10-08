import type { Hono } from "hono";
import { routePatterns, StartBuildSchema } from "@tesseract/protocol";
import type { Services } from "../../services";
import { idParam, jsonBody, logTail, projectFilter } from "../validation";

export function registerBuildRoutes(app: Hono, services: Services): void {
  const { rest } = routePatterns;
  const { builds } = services;

  app.get(rest.builds, (c) => c.json(builds.list(projectFilter(c))));

  app.post(rest.builds, async (c) => {
    const input = await jsonBody(c, StartBuildSchema);
    return c.json(await builds.start(input), 201);
  });

  app.get(rest.build, (c) => c.json(builds.get(idParam(c, "build"))));

  app.delete(rest.build, async (c) => c.json(await builds.cancel(idParam(c, "build"))));

  app.get(rest.buildLogs, (c) => c.json(builds.logTail(idParam(c, "build"), logTail(c))));
}
