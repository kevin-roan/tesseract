import type { Hono } from "hono";
import { routePatterns } from "@theone/protocol";
import type { Services } from "../../services";
import { idParam, projectFilter } from "../validation";

const MIME_TYPES: Record<string, string> = {
  ".apk": "application/vnd.android.package-archive",
  ".zip": "application/zip",
  ".exe": "application/vnd.microsoft.portable-executable",
  ".deb": "application/vnd.debian.binary-package",
};

function contentType(fileName: string): string {
  const extension = /\.[^.]+$/.exec(fileName)?.[0]?.toLowerCase() ?? "";
  return MIME_TYPES[extension] ?? "application/octet-stream";
}

export function registerArtifactRoutes(app: Hono, services: Services): void {
  const { rest } = routePatterns;
  const { artifacts } = services;

  app.get(rest.artifacts, (c) => c.json(artifacts.list(projectFilter(c))));

  app.get(rest.artifactDownload, (c) => {
    const { artifact, path } = artifacts.download(idParam(c, "artifact"));
    return new Response(Bun.file(path), {
      headers: {
        "Content-Type": contentType(artifact.fileName),
        "Content-Disposition": `attachment; filename="${artifact.fileName.replace(/["\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(artifact.fileName)}`,
        "Cache-Control": "no-store",
        "X-Content-SHA256": artifact.sha256,
      },
    });
  });
}
