import type { Hono } from "hono";
import { ClaudeHookPayloadSchema, InboxQuerySchema, MarkInboxReadSchema, routePatterns } from "@tesseract/protocol";
import type { Services } from "../../services";
import { jsonBody, parseWith } from "../validation";

export function registerInboxRoutes(app: Hono, services: Services): void {
  const { rest } = routePatterns;
  const { inbox, claudeHooks } = services;

  app.get(rest.inbox, (c) => c.json(inbox.list(parseWith(InboxQuerySchema, c.req.query(), "query"))));

  app.post(rest.inboxRead, async (c) => c.json(inbox.markRead(await jsonBody(c, MarkInboxReadSchema))));

  app.post(rest.claudeHook, async (c) => {
    await claudeHooks.ingest(await jsonBody(c, ClaudeHookPayloadSchema));
    return c.body(null, 202);
  });
}
