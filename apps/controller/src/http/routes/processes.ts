import type { Hono } from "hono";
import { routePatterns, StartProcessSchema } from "@theone/protocol";
import type { Services } from "../../services";
import { idParam, jsonBody, logTail, projectFilter } from "../validation";

export function registerProcessRoutes(app: Hono, services: Services): void {
  const { rest } = routePatterns;
  const { processes } = services;

  app.get(rest.processes, (c) => c.json(processes.list(projectFilter(c))));

  app.post(rest.processes, async (c) => {
    const input = await jsonBody(c, StartProcessSchema);
    return c.json(await processes.start(input), 201);
  });

  app.get(rest.process, (c) => c.json(processes.get(idParam(c, "process"))));

  app.delete(rest.process, async (c) => c.json(await processes.stop(idParam(c, "process"))));

  app.get(rest.processLogs, (c) => c.json(processes.logTail(idParam(c, "process"), logTail(c))));
}
