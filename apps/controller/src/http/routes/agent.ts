import type { Hono } from "hono";
import { AgentRunQuerySchema, ArchiveAgentRunsSchema, DeleteAgentRunsSchema, routePatterns, StartAgentRunSchema } from "@tesseract/protocol";
import type { Services } from "../../services";
import { idParam, jsonBody, parseWith } from "../validation";

const isTruthy = (flag: string | undefined) => flag === "1" || flag === "true";

export function registerAgentRoutes(app: Hono, services: Services): void {
  const { rest } = routePatterns;
  const { agentRuns } = services;

  app.get(rest.agentRuns, (c) => {
    const query = parseWith(AgentRunQuerySchema, c.req.query(), "query");
    return c.json(agentRuns.list({ projectId: query.projectId, archived: isTruthy(query.archived) }));
  });

  app.post(rest.agentRuns, async (c) => {
    const input = await jsonBody(c, StartAgentRunSchema);
    return c.json(agentRuns.start(input), 201);
  });

  app.post(rest.agentRunsArchive, async (c) => c.json(agentRuns.archive(await jsonBody(c, ArchiveAgentRunsSchema))));

  app.post(rest.agentRunsDelete, async (c) => c.json(agentRuns.delete(await jsonBody(c, DeleteAgentRunsSchema))));

  app.get(rest.agentRun, (c) => c.json(agentRuns.get(idParam(c, "agentRun"))));

  app.delete(rest.agentRun, async (c) => c.json(await agentRuns.cancel(idParam(c, "agentRun"))));
}
