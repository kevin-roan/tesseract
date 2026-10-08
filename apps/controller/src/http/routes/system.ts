import type { Context, Hono } from "hono";
import { getConnInfo } from "hono/bun";
import {
  ClaudeImportSchema,
  CloseDisplayWindowSchema,
  SetDefaultClaudeAccountSchema,
  PROTOCOL_VERSION,
  routePatterns,
  SessionsQuerySchema,
  StatusEventInputSchema,
  UsageQuerySchema,
  type Health,
} from "@tesseract/protocol";
import { nowIso } from "../../core/time";
import type { Services } from "../../services";
import { jsonBody, optionalJsonBody, parseWith } from "../validation";

function remoteAddress(c: Context): { address: string; port: number } | null {
  try {
    const { address, port } = getConnInfo(c).remote;
    return address && port !== undefined ? { address, port } : null;
  } catch {
    return null;
  }
}

export function registerSystemRoutes(app: Hono, services: Services): void {
  const { rest } = routePatterns;

  app.get(rest.health, (c) => {
    const health: Health = {
      ok: true,
      version: services.version,
      protocolVersion: PROTOCOL_VERSION,
      sandboxId: services.config.sandboxId,
    };
    return c.json(health);
  });

  app.post(rest.authTicket, (c) => c.json(services.tickets.issue()));

  app.get(rest.status, async (c) => c.json(await services.status.status()));

  app.get(rest.context, (c) => c.json(services.context()));

  app.get(rest.identity, async (c) =>
    c.json(await services.identity.identity({ headers: c.req.raw.headers, remote: remoteAddress(c) })),
  );

  app.get(rest.claudeAuth, (c) => c.json(services.claudeAuth.status()));

  app.post(rest.claudeImport, async (c) => c.json(services.claudeAuth.import(await jsonBody(c, ClaudeImportSchema))));

  app.get(rest.claudeAccounts, (c) => c.json(services.claudeAccounts.list()));

  app.put(rest.claudeDefaultAccount, async (c) =>
    c.json(services.claudeAccounts.setDefault((await jsonBody(c, SetDefaultClaudeAccountSchema)).accountId)),
  );

  app.get(rest.ports, async (c) => c.json(await services.ports.list()));

  app.get(rest.usage, async (c) => c.json(await services.usage.usage(parseWith(UsageQuerySchema, c.req.query(), "query"))));

  app.get(rest.sessions, async (c) => c.json(await services.usage.sessions(parseWith(SessionsQuerySchema, c.req.query(), "query"))));

  app.get(rest.display, async (c) => c.json(await services.display.status()));

  app.get(rest.displayBrowser, async (c) => c.json(await services.browser.status()));

  app.get(rest.displayWindows, async (c) => c.json(await services.display.windows()));

  app.post(rest.displayWindowActivate, async (c) => {
    await services.display.activateWindow(c.req.param("id") ?? "");
    return c.body(null, 204);
  });

  app.post(rest.displayWindowClose, async (c) => {
    const body = await optionalJsonBody(c, CloseDisplayWindowSchema, {});
    await services.display.closeWindow(c.req.param("id") ?? "", body.force ?? false);
    return c.body(null, 204);
  });

  app.get(rest.displayScreenshot, async (c) => {
    const png = await services.display.screenshot();
    return c.body(png as Uint8Array<ArrayBuffer>, 200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
  });

  app.post(rest.events, async (c) => {
    const input = await jsonBody(c, StatusEventInputSchema);
    services.hub.publish({ type: "status", event: { ...input, ts: nowIso() } });
    return c.body(null, 202);
  });
}
