import type { Hono } from "hono";
import { routePatterns, RuntimeKindSchema } from "@tesseract/protocol";
import type { Services } from "../../services";
import { notFound } from "../../core/errors";
import { stopSignal } from "../validation";

export function registerRuntimeRoutes(app: Hono, services: Services): void {
  const { rest } = routePatterns;
  const { sandboxRuntime } = services;

  app.get(rest.runtime, async (c) => c.json({ entries: await sandboxRuntime.list() }));

  app.delete(rest.runtimeEntry, async (c) => {
    const kind = RuntimeKindSchema.safeParse(c.req.param("kind"));
    const id = c.req.param("id") ?? "";
    if (!kind.success) throw notFound(`Unknown runtime kind ${(c.req.param("kind") ?? "").slice(0, 40)}`);
    const signal = stopSignal(c);
    return c.json(await sandboxRuntime.stop(kind.data, id, signal));
  });
}
