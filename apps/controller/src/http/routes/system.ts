import type { Hono } from "hono";
import { PROTOCOL_VERSION, routePatterns, StatusEventInputSchema, type Health } from "@theone/protocol";
import { nowIso } from "../../core/time";
import type { Services } from "../../services";
import { jsonBody } from "../validation";

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

  app.get(rest.display, async (c) => c.json(await services.display.status()));

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
