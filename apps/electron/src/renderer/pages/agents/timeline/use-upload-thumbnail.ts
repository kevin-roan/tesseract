import type { TesseractClient } from "@tesseract/client";
import type { Upload } from "@tesseract/protocol";
import { ipcFetch, useApiQuery } from "../../../app/data";
import { isFixtureMode } from "../../../app/runtime";
import { fixtureFetch } from "../../../fixtures/fetch";

const objectUrls = new Map<string, string>();

async function loadThumbnail(client: TesseractClient, upload: Upload, signal: AbortSignal): Promise<string> {
  const cached = objectUrls.get(upload.id);
  if (cached) return cached;
  const url = await client.uploadContentUrl(upload.id, { signal });
  const fetchImpl = isFixtureMode() ? fixtureFetch : ipcFetch;
  const response = await fetchImpl(url, { method: "GET", headers: {}, signal });
  if (!response.ok) throw new Error(response.statusText);
  const type = response.headers.get("content-type") ?? upload.mimeType;
  const objectUrl = URL.createObjectURL(new Blob([await response.arrayBuffer()], { type }));
  objectUrls.set(upload.id, objectUrl);
  return objectUrl;
}

export function useUploadThumbnail(upload: Upload): string | null {
  const enabled = upload.kind === "image";
  const query = useApiQuery(["agents", "upload-thumbnail", upload.id], (client, signal) => loadThumbnail(client, upload, signal), {
    enabled,
    staleTime: Infinity,
    retry: false,
  });
  return query.data ?? null;
}
