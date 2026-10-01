import type { Context, Hono } from "hono";
import {
  ClaimSyncRequestSchema,
  CompleteSyncRequestSchema,
  CreateSyncRequestSchema,
  routePatterns,
  SyncAckSchema,
  SyncExportSchema,
  SyncHeartbeatSchema,
  SyncRequestsQuerySchema,
} from "@theone/protocol";
import type { Services } from "../../services";
import { disableIdleTimeout } from "../idle-timeout";
import { idParam, jsonBody, parseWith } from "../validation";

export function registerSyncRoutes(app: Hono, services: Services): void {
  const { rest } = routePatterns;
  const { syncBack } = services;
  const projectId = (c: Context) => c.req.param("id") ?? "";

  app.get(rest.projectSyncChanges, async (c) => c.json(await syncBack.changes(projectId(c))));

  app.post(rest.projectSyncExport, async (c) => {
    const { paths } = await jsonBody(c, SyncExportSchema);
    const archive = await syncBack.export(projectId(c), paths);
    disableIdleTimeout(c);
    return new Response(archive, {
      headers: { "Content-Type": "application/gzip", "Content-Disposition": `attachment; filename="${projectId(c)}-sync.tar.gz"` },
    });
  });

  app.post(rest.projectSyncAck, async (c) => c.json(await syncBack.ack(projectId(c), await jsonBody(c, SyncAckSchema))));

  app.get(rest.projectSyncRequests, (c) => c.json(syncBack.projectRequests(projectId(c))));

  app.post(rest.projectSyncRequests, async (c) =>
    c.json(syncBack.createRequest(projectId(c), await jsonBody(c, CreateSyncRequestSchema)), 201),
  );

  app.get(rest.syncRequests, (c) => c.json(syncBack.requests(parseWith(SyncRequestsQuerySchema, c.req.query(), "query").status)));

  app.post(rest.syncRequestClaim, async (c) => {
    const id = idParam(c, "sync");
    return c.json(syncBack.claim(id, (await jsonBody(c, ClaimSyncRequestSchema)).host));
  });

  app.post(rest.syncRequestComplete, async (c) => {
    const id = idParam(c, "sync");
    return c.json(syncBack.complete(id, await jsonBody(c, CompleteSyncRequestSchema)));
  });

  app.post(rest.syncRequestCancel, (c) => c.json(syncBack.cancel(idParam(c, "sync"))));

  app.post(rest.syncHeartbeat, async (c) => {
    syncBack.heartbeat(await jsonBody(c, SyncHeartbeatSchema));
    return c.body(null, 204);
  });
}
