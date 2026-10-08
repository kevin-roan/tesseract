import type { Hono } from "hono";
import { BuildOutputQuerySchema, routePatterns, SendArtifactSchema, ShareArtifactSchema } from "@tesseract/protocol";
import type { Services } from "../../services";
import { fileResponse } from "../file-response";
import { idParam, jsonBody, parseWith, projectFilter } from "../validation";

const MIME_TYPES: Record<string, string> = {
  ".apk": "application/vnd.android.package-archive",
  ".zip": "application/zip",
  ".exe": "application/vnd.microsoft.portable-executable",
  ".deb": "application/vnd.debian.binary-package",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
};

function contentType(fileName: string): string {
  const extension = /\.[^.]+$/.exec(fileName)?.[0]?.toLowerCase() ?? "";
  return MIME_TYPES[extension] ?? "application/octet-stream";
}

export function registerArtifactRoutes(app: Hono, services: Services): void {
  const { rest } = routePatterns;
  const { artifacts, buildOutputs, taildrop } = services;

  app.get(rest.artifacts, (c) => c.json(artifacts.list(projectFilter(c))));

  app.post(rest.artifacts, async (c) => c.json(await artifacts.share(await jsonBody(c, ShareArtifactSchema)), 201));

  app.delete(rest.artifact, async (c) => c.json(await artifacts.delete(idParam(c, "artifact"))));

  app.get(rest.taildropTargets, async (c) => c.json(await taildrop.targets()));

  app.post(rest.artifactTaildrop, async (c) => {
    const id = idParam(c, "artifact");
    const { targetId } = await jsonBody(c, SendArtifactSchema);
    return c.json(await taildrop.send(id, targetId));
  });

  app.get(rest.buildOutputs, async (c) => c.json(await buildOutputs.list(projectFilter(c))));

  app.get(rest.buildOutputDownload, async (c) => {
    const query = parseWith(BuildOutputQuerySchema, c.req.query(), "query");
    const { output, path } = await buildOutputs.resolve(c.req.param("id") ?? "", query.path);
    return fileResponse(path, { fileName: output.fileName, contentType: contentType(output.fileName), range: c.req.header("range") });
  });

  app.get(rest.artifactDownload, (c) => {
    const { artifact, path } = artifacts.download(idParam(c, "artifact"));
    return fileResponse(path, {
      fileName: artifact.fileName,
      contentType: contentType(artifact.fileName),
      range: c.req.header("range"),
      headers: { "X-Content-SHA256": artifact.sha256 },
    });
  });
}
