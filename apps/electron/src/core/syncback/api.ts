import { openAsBlob } from "node:fs";
import { readFile } from "node:fs/promises";
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
  pushProject(projectId: string, archiveFile: string, confidential: boolean): Promise<PushResult>;
}

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

  private async send(method: string, path: string, init: { body?: BodyInit; json?: unknown; contentType?: string }): Promise<Response> {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.options.token}`, Accept: "application/json" };
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
      response = await fetchImpl(`${this.baseUrl}${path}`, { method, headers, body, signal: AbortSignal.timeout(SYNC_TIMEOUT_MS) });
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

  async pushProject(projectId: string, archiveFile: string, confidential: boolean): Promise<PushResult> {
    const path = `${restPaths.projectSync(projectId)}${confidential ? CONFIDENTIAL_QUERY : ""}`;
    const body = await archiveBody(archiveFile);
    const response = await this.send("POST", path, { body, contentType: GZIP_MIME_TYPE });
    const data: unknown = await response.json();
    const parsed = ProjectSchema.safeParse(data);
    const project = parsed.success ? parsed.data : (data as PushResult["project"]);
    return { project, created: response.status === CREATED_STATUS };
  }
}
