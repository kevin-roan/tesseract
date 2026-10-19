import type { Hono } from "hono";
import { AppRunActionRequestSchema, InstallOnSimulatorSchema, routePatterns, StartAppRunSchema } from "@tesseract/protocol";
import type { Services } from "../../services";
import { idParam, jsonBody, projectFilter, stopSignal } from "../validation";

export function registerAppRoutes(app: Hono, services: Services): void {
  const { rest } = routePatterns;
  const { appRuns, android, ios, artifacts } = services;

  app.get(rest.projectRunTargets, async (c) => c.json(await appRuns.targets(c.req.param("id") ?? "")));

  app.get(rest.appRuns, (c) => c.json(appRuns.list(projectFilter(c))));

  app.post(rest.projectAppRuns, async (c) => {
    const input = await jsonBody(c, StartAppRunSchema);
    return c.json(await appRuns.start(c.req.param("id") ?? "", input), 201);
  });

  app.get(rest.appRun, (c) => c.json(appRuns.get(idParam(c, "appRun"))));

  app.delete(rest.appRun, async (c) => c.json(await appRuns.stop(idParam(c, "appRun"), stopSignal(c))));

  app.post(rest.appRunActions, async (c) => {
    const id = idParam(c, "appRun");
    const { action } = await jsonBody(c, AppRunActionRequestSchema);
    return c.json(await appRuns.action(id, action));
  });

  app.get(rest.android, async (c) => c.json(await android.status()));

  app.get(rest.ios, (c) => c.json(ios.status()));

  app.post(rest.iosInstalls, async (c) => {
    const { artifactId } = await jsonBody(c, InstallOnSimulatorSchema);
    artifacts.get(artifactId);
    return c.json(ios.install(artifactId), 202);
  });
}
