import { createReadStream, openAsBlob } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { ApiError, NetworkError, TesseractClient, TimeoutError, type FetchLike } from "@tesseract/client";
import {
  ProjectSchema,
  SyncGetPlanResponseSchema,
  SyncRequestSchema,
  errorCodeForStatus,
  isErrorCode,
  restPaths,
  type CompleteSyncRequest,
  type CreateSyncRequest,
  type Project,
  type SyncAck,
  type SyncChanges,
  type SyncGetPlan,
  type SyncGetPlanResponse,
  type SyncHeartbeat,
  type SyncRequest,
} from "@tesseract/protocol";
import { GZIP_MIME_TYPE, SYNC_TIMEOUT_MS } from "./constants";

export type ByteStream = AsyncIterable<Uint8Array | Buffer | string>;

export interface PushResult {
  project: Pick<Project, "path"> & Partial<Project>;
  created: boolean;
}

export interface SyncApi {
  syncChanges(projectId: string): Promise<SyncChanges>;
  syncExport(projectId: string, paths: string[]): Promise<ByteStream>;
  syncAck(projectId: string, changes: SyncAck["changes"]): Promise<unknown>;
  claimRequest(requestId: string, host: string): Promise<SyncRequest>;
  completeRequest(requestId: string, body: CompleteSyncRequest): Promise<SyncRequest>;
  planGet(requestId: string, plan: SyncGetPlan): Promise<SyncGetPlanResponse>;
  applyGet(requestId: string, archiveFile: string): Promise<SyncRequest>;
  heartbeat(body: SyncHeartbeat): Promise<void>;
  pendingRequests(): Promise<SyncRequest[]>;
  createRequest(projectId: string, body: CreateSyncRequest): Promise<SyncRequest>;
  projectIds(): Promise<string[]>;
  /** `onSent(sent, total)` follows the archive upload byte by byte. */
  pushProject(projectId: string, archiveFile: string, confidential: boolean, onSent?: UploadProgress): Promise<PushResult>;
}

export type UploadProgress = (sent: number, total: number) => void;

export interface HttpSyncApiOptions {
  apiUrl: string;
  token: string;
  fetch?: FetchLike;
}

const CREATED_STATUS = 201;
const CONFIDENTIAL_QUERY = "?confidential=1";
const ERROR_TEXT_LIMIT = 300;

async function archiveBody(file: string): Promise<Blob> {
  if (typeof openAsBlob === "function") {
    try {
      return await openAsBlob(file);
    } catch {
      return new Blob([new Uint8Array(await readFile(file))]);
    }
  }
  return new Blob([new Uint8Array(await readFile(file))]);
}

const UPLOAD_CHUNK_BYTES = 256 * 1024;

/** The archive as a stream that reports how much of it fetch has taken so far. */
function countingBody(file: string, total: number, onSent: UploadProgress): ReadableStream<Uint8Array> {
  const source = createReadStream(file, { highWaterMark: UPLOAD_CHUNK_BYTES });
  const chunks = source[Symbol.asyncIterator]() as AsyncIterator<Buffer>;
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await chunks.next();
      if (next.done) {
        controller.close();
        return;
      }
      sent += next.value.length;
      controller.enqueue(new Uint8Array(next.value.buffer, next.value.byteOffset, next.value.length));
      onSent(sent, total);
    },
    cancel() {
      source.destroy();
    },
  });
}

async function* single(chunk: Uint8Array): AsyncGenerator<Uint8Array> {
  yield chunk;
}

function errorBody(text: string): { code?: unknown; message?: unknown } | null {
  try {
    const body = JSON.parse(text) as { error?: { code?: unknown; message?: unknown } } | null;
    return typeof body?.error === "object" && body.error !== null ? body.error : null;
  } catch {
    return null;
  }
}

async function apiError(response: Response): Promise<ApiError> {
  const text = await response.text().catch(() => "");
  const error = errorBody(text);
  if (typeof error?.message === "string") {
    const code = typeof error.code === "string" && isErrorCode(error.code) ? error.code : errorCodeForStatus(response.status);
    return new ApiError(response.status, code, error.message);
  }
  const fallback = text.trim().slice(0, ERROR_TEXT_LIMIT) || response.statusText || `HTTP ${response.status}`;
  return new ApiError(response.status, errorCodeForStatus(response.status), fallback);
}

export class HttpSyncApi implements SyncApi {
  readonly client: TesseractClient;
  private readonly baseUrl: string;

  constructor(private readonly options: HttpSyncApiOptions) {
    this.client = new TesseractClient({ baseUrl: options.apiUrl, token: options.token, fetch: options.fetch });
    this.baseUrl = this.client.baseUrl;
  }

  private async send(
    method: string,
    path: string,
    init: { body?: BodyInit; json?: unknown; contentType?: string; contentLength?: number },
  ): Promise<Response> {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.options.token}`, Accept: "application/json" };
    if (init.contentLength !== undefined) headers["Content-Length"] = String(init.contentLength);
    let body = init.body;
    if (init.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(init.json);
    } else if (init.contentType) {
      headers["Content-Type"] = init.contentType;
    }
    const fetchImpl = (this.options.fetch ?? fetch) as typeof fetch;
    let response: Response;
    try {
      // A stream body needs `duplex: "half"` in Node's fetch (Bun ignores it).
      const stream = body instanceof ReadableStream ? { duplex: "half" } : {};
      response = await fetchImpl(`${this.baseUrl}${path}`, { method, headers, body, signal: AbortSignal.timeout(SYNC_TIMEOUT_MS), ...stream } as RequestInit);
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") throw new TimeoutError(path, SYNC_TIMEOUT_MS);
      throw new NetworkError(`Request to ${path} failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
    if (!response.ok) throw await apiError(response);
    return response;
  }

  syncChanges(projectId: string): Promise<SyncChanges> {
    return this.client.syncChanges(projectId);
  }

  async syncExport(projectId: string, paths: string[]): Promise<ByteStream> {
    const response = await this.send("POST", restPaths.projectSyncExport(projectId), { json: { paths } });
    if (!response.body) return single(new Uint8Array(await response.arrayBuffer()));
    return response.body as unknown as ByteStream;
  }

  syncAck(projectId: string, changes: SyncAck["changes"]): Promise<SyncChanges> {
    return this.client.syncAck(projectId, { changes });
  }

  claimRequest(requestId: string, host: string): Promise<SyncRequest> {
    return this.client.claimSyncRequest(requestId, { host });
  }

  completeRequest(requestId: string, body: CompleteSyncRequest): Promise<SyncRequest> {
    return this.client.completeSyncRequest(requestId, body);
  }

  async planGet(requestId: string, plan: SyncGetPlan): Promise<SyncGetPlanResponse> {
    const response = await this.send("POST", restPaths.syncRequestPlan(requestId), { json: plan });
    return SyncGetPlanResponseSchema.parse(await response.json());
  }

  async applyGet(requestId: string, archiveFile: string): Promise<SyncRequest> {
    const body = await archiveBody(archiveFile);
    const response = await this.send("POST", restPaths.syncRequestApply(requestId), { body, contentType: GZIP_MIME_TYPE });
    return SyncRequestSchema.parse(await response.json());
  }

  heartbeat(body: SyncHeartbeat): Promise<void> {
    return this.client.syncHeartbeat(body);
  }

  pendingRequests(): Promise<SyncRequest[]> {
    return this.client.pendingSyncRequests();
  }

  createRequest(projectId: string, body: CreateSyncRequest): Promise<SyncRequest> {
    return this.client.createSyncRequest(projectId, body);
  }

  async projectIds(): Promise<string[]> {
    return (await this.client.listProjects()).map((project) => project.id);
  }

  async pushProject(projectId: string, archiveFile: string, confidential: boolean, onSent?: UploadProgress): Promise<PushResult> {
    const path = `${restPaths.projectSync(projectId)}${confidential ? CONFIDENTIAL_QUERY : ""}`;
    let response: Response;
    if (onSent) {
      const size = (await stat(archiveFile)).size;
      onSent(0, size);
      response = await this.send("POST", path, { body: countingBody(archiveFile, size, onSent), contentType: GZIP_MIME_TYPE, contentLength: size });
    } else {
      response = await this.send("POST", path, { body: await archiveBody(archiveFile), contentType: GZIP_MIME_TYPE });
    }
    const data: unknown = await response.json();
    const parsed = ProjectSchema.safeParse(data);
    const project = parsed.success ? parsed.data : (data as PushResult["project"]);
    return { project, created: response.status === CREATED_STATUS };
  }
}
