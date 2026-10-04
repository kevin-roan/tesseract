import type { Context, Hono } from "hono";
import {
  ClaimSyncRequestSchema,
  CompleteSyncRequestSchema,
  CreateSyncRequestSchema,
  routePatterns,
  SyncAckSchema,
  SyncDiscardSchema,
  SyncExportSchema,
  SyncGetPlanSchema,
  SyncHeartbeatSchema,
  SyncRequestsQuerySchema,
} from "@theone/protocol";
import type { Services } from "../../services";
import { badRequest } from "../../core/errors";
import { isSyncFormat } from "../../services/projects";
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

  app.post(rest.projectSyncDiscard, async (c) => {
    const result = await syncBack.discard(projectId(c), await jsonBody(c, SyncDiscardSchema));
    if (result.discarded.length > 0) await services.projects.publish(result.changes.projectId);
    return c.json(result);
  });

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

  app.post(rest.syncRequestPlan, async (c) => {
    const id = idParam(c, "sync");
    return c.json(await syncBack.planGet(id, await jsonBody(c, SyncGetPlanSchema)));
  });

  app.post(rest.syncRequestApply, async (c) => {
    const id = idParam(c, "sync");
    const format = (c.req.header("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (!isSyncFormat(format)) throw badRequest("Send the archive as application/x-tar or application/gzip");
    const body = c.req.raw.body;
    if (!body) throw badRequest("Missing archive body");
    disableIdleTimeout(c);
    const request = await syncBack.applyGet(id, format, body);
    if (request.status === "applied") await services.projects.publish(request.projectId);
    return c.json(request);
  });

  app.post(rest.syncHeartbeat, async (c) => {
    syncBack.heartbeat(await jsonBody(c, SyncHeartbeatSchema));
    return c.body(null, 204);
  });
}
