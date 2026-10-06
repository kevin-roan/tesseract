import type { Hono } from "hono";
import { CreateTranscriptionSchema, CreateUploadSchema, routePatterns, UpdateSttSchema } from "@theone/protocol";
import type { Services } from "../../services";
import { fileResponse } from "../file-response";
import { disableIdleTimeout } from "../idle-timeout";
import { idParam, jsonBody } from "../validation";

export function registerUploadRoutes(app: Hono, services: Services): void {
  const { rest } = routePatterns;
  const { uploads, transcriptions } = services;

  app.post(rest.uploads, async (c) => c.json(await uploads.create(await jsonBody(c, CreateUploadSchema)), 201));

  app.get(rest.uploadContent, (c) => {
    const { upload, path } = uploads.content(idParam(c, "upload"));
    return fileResponse(path, {
      fileName: upload.name,
      contentType: upload.mimeType,
      disposition: upload.kind === "file" ? "attachment" : "inline",
      range: c.req.header("range"),
      headers: { "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox" },
    });
  });

  app.post(rest.transcriptions, async (c) => {
    disableIdleTimeout(c);
    return c.json(await transcriptions.transcribe(await jsonBody(c, CreateTranscriptionSchema)));
  });

  app.get(rest.stt, (c) => c.json(transcriptions.status()));

  app.put(rest.stt, async (c) => c.json(transcriptions.update(await jsonBody(c, UpdateSttSchema))));
}
