import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { ApiError, NetworkError, TimeoutError, type FetchLike } from "@tesseract/client";
import {
  DeployListSchema,
  DeploySchema,
  LIMITS,
  errorCodeForStatus,
  isErrorCode,
  normalizeBaseUrl,
  restPaths,
  type CompleteDeploy,
  type Deploy,
  type DeployFilter,
  type DeployProgress,
  type PutDeployTargets,
} from "@tesseract/protocol";
import { BUNDLE_FILE_MODE, DOWNLOAD_TIMEOUT_MS, ERROR_TEXT_LIMIT, REQUEST_TIMEOUT_MS, SHA256_HEADER } from "./constants";
import { DEPLOY_MESSAGES } from "./labels";

export interface DownloadedBundle {
  bytes: number;
  sha256: string;
  header: string | null;
}

export interface DeployApi {
  putTargets(body: PutDeployTargets): Promise<void>;
  list(query?: DeployFilter): Promise<Deploy[]>;
  get(id: string): Promise<Deploy>;
  claim(id: string, host: string): Promise<Deploy>;
  progress(id: string, body: DeployProgress): Promise<Deploy>;
  complete(id: string, body: CompleteDeploy): Promise<Deploy>;
  download(id: string, file: string): Promise<DownloadedBundle>;
}

export interface HttpDeployApiOptions {
  apiUrl: string;
  token: string;
  fetch?: FetchLike;
}

async function apiError(response: Response): Promise<ApiError> {
  const text = await response.text().catch(() => "");
  let message: unknown;
  let code: unknown;
  try {
    const body = JSON.parse(text) as { error?: { code?: unknown; message?: unknown } } | null;
    message = body?.error?.message;
    code = body?.error?.code;
  } catch {
    message = undefined;
  }
  if (typeof message === "string") return new ApiError(response.status, typeof code === "string" && isErrorCode(code) ? code : errorCodeForStatus(response.status), message);
  const fallback = text.trim().slice(0, ERROR_TEXT_LIMIT) || response.statusText || `HTTP ${response.status}`;
  return new ApiError(response.status, errorCodeForStatus(response.status), fallback);
}

export class HttpDeployApi implements DeployApi {
  private readonly baseUrl: string;

  constructor(private readonly options: HttpDeployApiOptions) {
    const baseUrl = normalizeBaseUrl(options.apiUrl);
    if (!baseUrl) throw new TypeError(`Invalid controller URL: ${options.apiUrl}`);
    this.baseUrl = baseUrl;
  }

  private async send(method: string, path: string, json?: unknown, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<Response> {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.options.token}`, Accept: "application/json" };
    if (json !== undefined) headers["Content-Type"] = "application/json";
    const fetchImpl = (this.options.fetch ?? fetch) as typeof fetch;
    let response: Response;
    try {
      response = await fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: json === undefined ? undefined : JSON.stringify(json),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") throw new TimeoutError(path, timeoutMs);
      throw new NetworkError(`Request to ${path} failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
    if (!response.ok) throw await apiError(response);
    return response;
  }

  private async deploy(method: string, path: string, json?: unknown): Promise<Deploy> {
    return DeploySchema.parse(await (await this.send(method, path, json)).json());
  }

  async putTargets(body: PutDeployTargets): Promise<void> {
    await this.send("PUT", restPaths.deployTargets(), body);
  }

  async list(query?: DeployFilter): Promise<Deploy[]> {
    return DeployListSchema.parse(await (await this.send("GET", restPaths.deploys(query))).json());
  }

  get(id: string): Promise<Deploy> {
    return this.deploy("GET", restPaths.deploy(id));
  }

  claim(id: string, host: string): Promise<Deploy> {
    return this.deploy("POST", restPaths.deployClaim(id), { host });
  }

  progress(id: string, body: DeployProgress): Promise<Deploy> {
    return this.deploy("POST", restPaths.deployProgress(id), body);
  }

  complete(id: string, body: CompleteDeploy): Promise<Deploy> {
    return this.deploy("POST", restPaths.deployComplete(id), body);
  }

  async download(id: string, file: string): Promise<DownloadedBundle> {
    const response = await this.send("GET", restPaths.deployBundle(id), undefined, DOWNLOAD_TIMEOUT_MS);
    const hash = createHash("sha256");
    let bytes = 0;
    const body = (response.body ?? [new Uint8Array(await response.arrayBuffer())]) as AsyncIterable<Uint8Array>;
    await pipeline(
      body,
      async function* (source: AsyncIterable<Uint8Array>) {
        for await (const chunk of source) {
          bytes += chunk.byteLength;
          if (bytes > LIMITS.maxDeployBundleBytes) throw new Error(DEPLOY_MESSAGES.tooLarge);
          hash.update(chunk);
          yield chunk;
        }
      },
      createWriteStream(file, { mode: BUNDLE_FILE_MODE }),
    );
    return { bytes, sha256: hash.digest("hex"), header: response.headers.get(SHA256_HEADER)?.trim().toLowerCase() || null };
  }
}
