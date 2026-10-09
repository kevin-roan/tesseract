import type { Hono } from "hono";
import { ClearProjectStorageSchema, ProjectFileQuerySchema, ProjectPathQuerySchema, routePatterns, SendProjectFileSchema } from "@tesseract/protocol";
import type { Services } from "../../services";
import { fileResponse } from "../file-response";
import { jsonBody, optionalJsonBody, parseWith } from "../validation";
import { contentType } from "./artifacts";

export function registerFileRoutes(app: Hono, services: Services): void {
  const { rest } = routePatterns;
  const { projectFiles, taildrop } = services;
  const projectId = (c: { req: { param: (name: string) => string | undefined } }) => c.req.param("id") ?? "";

  app.get(rest.projectFiles, async (c) => {
    const { path } = parseWith(ProjectPathQuerySchema, c.req.query(), "query");
    return c.json(await projectFiles.list(projectId(c), path));
  });

  app.get(rest.projectFileDownload, async (c) => {
    const { path } = parseWith(ProjectFileQuerySchema, c.req.query(), "query");
    const { file, path: real } = await projectFiles.resolveFile(projectId(c), path);
    return fileResponse(real, { fileName: file.name, contentType: contentType(file.name), range: c.req.header("range") });
  });

  app.post(rest.projectFileTaildrop, async (c) => {
    const { path, targetId } = await jsonBody(c, SendProjectFileSchema);
    const { file, path: real } = await projectFiles.resolveFile(projectId(c), path);
    await taildrop.sendFile(real, file.name, targetId);
    return c.json(file);
  });

  app.get(rest.projectStorage, async (c) => c.json(await projectFiles.measure(projectId(c))));

  app.post(rest.projectStorageClear, async (c) => {
    const { categories } = await optionalJsonBody(c, ClearProjectStorageSchema, {});
    return c.json(await projectFiles.clear(projectId(c), categories));
  });
}
