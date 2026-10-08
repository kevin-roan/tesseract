import type { Hono } from "hono";
import { CreateTerminalSchema, routePatterns } from "@tesseract/protocol";
import type { Services } from "../../services";
import { idParam, jsonBody } from "../validation";

export function registerTerminalRoutes(app: Hono, services: Services): void {
  const { rest } = routePatterns;
  const { terminals } = services;

  app.get(rest.terminals, (c) => c.json(terminals.list()));

  app.post(rest.terminals, async (c) => {
    const input = await jsonBody(c, CreateTerminalSchema);
    return c.json(terminals.create(input), 201);
  });

  app.delete(rest.terminal, async (c) => c.json(await terminals.close(idParam(c, "terminal"))));
}
