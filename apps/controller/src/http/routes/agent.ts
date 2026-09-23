import type { Hono } from "hono";
import { routePatterns, StartAgentRunSchema } from "@theone/protocol";
import type { Services } from "../../services";
import { idParam, jsonBody, projectFilter } from "../validation";

export function registerAgentRoutes(app: Hono, services: Services): void {
  const { rest } = routePatterns;
  const { agentRuns } = services;

  app.get(rest.agentRuns, (c) => c.json(agentRuns.list(projectFilter(c))));

  app.post(rest.agentRuns, async (c) => {
    const input = await jsonBody(c, StartAgentRunSchema);
    return c.json(agentRuns.start(input), 201);
  });

  app.get(rest.agentRun, (c) => c.json(agentRuns.get(idParam(c, "agentRun"))));

  app.delete(rest.agentRun, async (c) => c.json(await agentRuns.cancel(idParam(c, "agentRun"))));
}
