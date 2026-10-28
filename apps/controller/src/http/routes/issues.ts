import type { Hono } from "hono";
import { CreateIssueCommentSchema, CreateIssueSchema, DispatchIssueSchema, IssueQuerySchema, routePatterns, UpdateIssueSchema } from "@tesseract/protocol";
import type { Services } from "../../services";
import { idParam, jsonBody, optionalJsonBody, parseWith } from "../validation";

export function registerIssueRoutes(app: Hono, services: Services): void {
  const { rest } = routePatterns;
  const { issues } = services;

  app.get(rest.issues, (c) => c.json(issues.list(parseWith(IssueQuerySchema, c.req.query(), "query"))));

  app.post(rest.projectIssues, async (c) => {
    const projectId = c.req.param("id") ?? "";
    return c.json(issues.create(projectId, await jsonBody(c, CreateIssueSchema)), 201);
  });

  app.get(rest.issue, (c) => c.json(issues.get(idParam(c, "issue"))));

  app.patch(rest.issue, async (c) => {
    const id = idParam(c, "issue");
    return c.json(issues.update(id, await jsonBody(c, UpdateIssueSchema)));
  });

  app.delete(rest.issue, (c) => c.json(issues.delete(idParam(c, "issue"))));

  app.post(rest.issueComments, async (c) => {
    const id = idParam(c, "issue");
    return c.json(issues.comment(id, await jsonBody(c, CreateIssueCommentSchema)), 201);
  });

  app.post(rest.issueDispatch, async (c) => {
    const id = idParam(c, "issue");
    return c.json(issues.dispatch(id, await optionalJsonBody(c, DispatchIssueSchema, {})));
  });
}
