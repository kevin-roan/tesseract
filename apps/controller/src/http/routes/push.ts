import type { Hono } from "hono";
import { LiveActivityPushTokenSchema, PushTokenSchema, RegisterLiveActivitySchema, RegisterPushDeviceSchema, routePatterns } from "@tesseract/protocol";
import type { Services } from "../../services";
import { jsonBody, parseWith } from "../validation";

export function registerPushRoutes(app: Hono, services: Services): void {
  const { rest } = routePatterns;
  const { push, liveActivity } = services;

  app.get(rest.pushDevices, (c) => c.json(push.list()));

  app.post(rest.pushDevices, async (c) => c.json(push.register(await jsonBody(c, RegisterPushDeviceSchema))));

  app.delete(rest.pushDevice, (c) => c.json(push.unregister(parseWith(PushTokenSchema, c.req.param("token"), "push token"))));

  app.get(rest.liveActivities, (c) => c.json(liveActivity.list()));

  app.post(rest.liveActivities, async (c) => c.json(liveActivity.register(await jsonBody(c, RegisterLiveActivitySchema))));

  app.delete(rest.liveActivity, (c) =>
    c.json(liveActivity.unregister(parseWith(LiveActivityPushTokenSchema, c.req.param("token"), "live activity token"))),
  );
}
