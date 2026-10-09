import { ApiError, type FetchLike, type HttpResponse, type TesseractClient } from "@tesseract/client";
import { errorCodeForStatus, restPaths } from "@tesseract/protocol";
import { describeError } from "../../app/connection";
import { SHA256_HEADER } from "./constants";
import { ARTIFACT_LABELS, formatLabel } from "./labels";
import { isMissing } from "./model";

export interface SaveTarget {
  name: string;
  write(data: Uint8Array): Promise<void>;
  commit(): Promise<void>;
  discard(): Promise<void>;
}

export type DownloadSource =
  | { kind: "artifact"; id: string }
  | { kind: "output"; projectId: string; path: string }
  | { kind: "project-file"; projectId: string; path: string };

export interface SaveRequest {
  source: DownloadSource;
  suggestedName: string;
  expectedSha256: string | null;
}

export interface SaveCallbacks {
  onStart(): void;
  onProgress(fraction: number): void;
}

export type FileSaver = (request: SaveRequest, callbacks: SaveCallbacks) => Promise<string | null>;

export function downloadUrl(client: TesseractClient, source: DownloadSource): string {
  switch (source.kind) {
    case "artifact":
      return client.httpUrl(restPaths.artifactDownload(source.id));
    case "output":
      return client.httpUrl(restPaths.buildOutputDownload(source.projectId, { path: source.path }));
    case "project-file":
      return client.httpUrl(restPaths.projectFileDownload(source.projectId, { path: source.path }));
  }
}

export interface DownloadRequest {
  url: string;
  headers: Record<string, string>;
  fetch: FetchLike;
  target: SaveTarget;
  expectedSha256?: string | null;
  useHeaderChecksum?: boolean;
  signal?: AbortSignal;
}

export class ChecksumError extends Error {
  constructor() {
    super(ARTIFACT_LABELS.checksum);
    this.name = "ChecksumError";
  }
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeSha(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

export function expectedChecksum(response: Pick<HttpResponse, "headers">, expected: string | null | undefined, useHeader: boolean): string | null {
  return normalizeSha(expected) ?? (useHeader ? normalizeSha(response.headers.get(SHA256_HEADER)) : null);
}

async function responseError(response: HttpResponse): Promise<ApiError> {
  let message = "";
  try {
    const body = JSON.parse(await response.text()) as { error?: { message?: unknown } };
    if (typeof body.error?.message === "string") message = body.error.message;
  } catch {
    message = "";
  }
  return new ApiError(response.status, errorCodeForStatus(response.status), message || response.statusText);
}

export async function runDownload(request: DownloadRequest): Promise<string> {
  const { target } = request;
  try {
    const response = await request.fetch(request.url, {
      method: "GET",
      headers: request.headers,
      signal: request.signal ?? new AbortController().signal,
    });
    if (!response.ok) throw await responseError(response);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const expected = expectedChecksum(response, request.expectedSha256, request.useHeaderChecksum ?? true);
    if (expected && (await sha256Hex(bytes)) !== expected) throw new ChecksumError();
    await target.write(bytes);
    await target.commit();
    return target.name;
  } catch (error) {
    await target.discard().catch(() => undefined);
    throw error;
  }
}

export function describeDownloadError(error: unknown, missing: string): string {
  return formatLabel(ARTIFACT_LABELS.failed, { error: isMissing(error) ? missing : describeError(error) });
}
