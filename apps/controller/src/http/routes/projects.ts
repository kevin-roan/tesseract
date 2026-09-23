import type { Hono } from "hono";
import { CreateProjectSchema, routePatterns } from "@theone/protocol";
import type { Services } from "../../services";
import { jsonBody } from "../validation";

export function registerProjectRoutes(app: Hono, services: Services): void {
  const { rest } = routePatterns;

  app.get(rest.projects, async (c) => c.json(await services.projects.list()));

  app.post(rest.projects, async (c) => {
    const input = await jsonBody(c, CreateProjectSchema);
    return c.json(await services.projects.create(input), 201);
  });

  app.get(rest.project, async (c) => c.json(await services.projects.get(c.req.param("id") ?? "")));

  app.get(rest.projectGit, async (c) => c.json(await services.projects.gitDetails(c.req.param("id") ?? "")));
}
