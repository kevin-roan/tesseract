import type { Hono } from "hono";
import {
  ClaimDeploySchema,
  CompleteDeploySchema,
  CreateDeploySchema,
  DeployProgressSchema,
  DeploysQuerySchema,
  PutDeployTargetsSchema,
  routePatterns,
} from "@tesseract/protocol";
import type { Services } from "../../services";
import { fileResponse } from "../file-response";
import { disableIdleTimeout } from "../idle-timeout";
import { idParam, jsonBody, parseWith } from "../validation";

export const DEPLOY_SHA256_HEADER = "x-tesseract-sha256";

export function registerDeployRoutes(app: Hono, services: Services): void {
  const { rest } = routePatterns;
  const { deploys } = services;

  app.get(rest.deploys, (c) => c.json(deploys.list(parseWith(DeploysQuerySchema, c.req.query(), "query"))));

  app.post(rest.deploys, async (c) => {
    const input = await jsonBody(c, CreateDeploySchema);
    disableIdleTimeout(c);
    return c.json(await deploys.create(input), 201);
  });

  app.get(rest.deployTargets, (c) => c.json(deploys.getTargets()));

  app.put(rest.deployTargets, async (c) => c.json(deploys.putTargets(await jsonBody(c, PutDeployTargetsSchema))));

  app.get(rest.deploy, (c) => c.json(deploys.get(idParam(c, "deploy"))));

  app.post(rest.deployClaim, async (c) => {
    const id = idParam(c, "deploy");
    return c.json(deploys.claim(id, await jsonBody(c, ClaimDeploySchema)));
  });

  app.get(rest.deployBundle, (c) => {
    const { deploy, path } = deploys.bundle(idParam(c, "deploy"));
    disableIdleTimeout(c);
    return fileResponse(path, {
      fileName: `${deploy.app}.tar.gz`,
      contentType: "application/gzip",
      range: c.req.header("range"),
      headers: { [DEPLOY_SHA256_HEADER]: deploy.sha256 },
    });
  });

  app.post(rest.deployProgress, async (c) => {
    const id = idParam(c, "deploy");
    return c.json(deploys.progress(id, await jsonBody(c, DeployProgressSchema)));
  });

  app.post(rest.deployComplete, async (c) => {
    const id = idParam(c, "deploy");
    return c.json(deploys.complete(id, await jsonBody(c, CompleteDeploySchema)));
  });

  app.post(rest.deployCancel, (c) => c.json(deploys.cancel(idParam(c, "deploy"))));
}
