import type { Hono } from "hono";
import { CreateProjectSchema, routePatterns, SetProjectClaudeAccountSchema } from "@theone/protocol";
import type { Services } from "../../services";
import { badRequest } from "../../core/errors";
import { isSyncFormat } from "../../services/projects";
import { disableIdleTimeout } from "../idle-timeout";
import { jsonBody } from "../validation";

export function registerProjectRoutes(app: Hono, services: Services): void {
  const { rest } = routePatterns;

  app.get(rest.projects, async (c) => c.json(await services.projects.list()));

  app.post(rest.projects, async (c) => {
    const input = await jsonBody(c, CreateProjectSchema);
    return c.json(await services.projects.create(input), 201);
  });

  app.get(rest.project, async (c) => c.json(await services.projects.get(c.req.param("id") ?? "")));

  app.delete(rest.project, async (c) => {
    const force = c.req.query("force");
    return c.json(await services.projects.remove(c.req.param("id") ?? "", { force: force === "1" || force === "true" }));
  });

  app.post(rest.projectSync, async (c) => {
    const format = (c.req.header("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (!isSyncFormat(format)) throw badRequest("Send the archive as application/x-tar or application/gzip");
    const body = c.req.raw.body;
    if (!body) throw badRequest("Missing archive body");
    disableIdleTimeout(c);
    const { project, created } = await services.projects.sync(c.req.param("id") ?? "", format, body, {
      confidential: c.req.query("confidential") === "1",
    });
    return c.json(project, created ? 201 : 200);
  });

  app.put(rest.projectClaudeAccount, async (c) => {
    const { accountId } = await jsonBody(c, SetProjectClaudeAccountSchema);
    if (accountId !== null) services.claudeAccounts.requireUsable(accountId);
    return c.json(await services.projects.setClaudeAccount(c.req.param("id") ?? "", accountId));
  });

  app.get(rest.projectGit, async (c) => c.json(await services.projects.gitDetails(c.req.param("id") ?? "")));
}
