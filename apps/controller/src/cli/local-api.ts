import { parseJson, type ErrorBody } from "@tesseract/protocol";
import { resolveToken } from "../auth/token";
import { localApiUrl, type Config } from "../config";

const REQUEST_TIMEOUT_MS = 10_000;

export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode = 1,
  ) {
    super(message);
    this.name = "CliError";
  }
}

export function requireToken(config: Config): string {
  const resolved = resolveToken(config, { create: false });
  if (!resolved) {
    throw new CliError(`No API token: set TESSERACT_TOKEN or start the controller once to create ${config.tokenFile}`);
  }
  return resolved.token;
}

function errorMessage(body: unknown, status: number): string {
  const error = (body as Partial<ErrorBody> | null)?.error;
  return error?.message ? `${error.code}: ${error.message}` : `HTTP ${status}`;
}

export async function fetchLocalApi(
  config: Config,
  method: string,
  path: string,
  body?: string,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const base = localApiUrl(config);
  try {
    return await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${requireToken(config)}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(`Controller not reachable at ${base} (${error instanceof Error ? error.message : String(error)})`);
  }
}

export async function callLocalApi<T>(config: Config, method: string, path: string, body?: unknown): Promise<T | null> {
  const response = await fetchLocalApi(config, method, path, body === undefined ? undefined : JSON.stringify(body));
  const text = await response.text();
  const parsed = text ? parseJson(text) : null;
  const value = parsed?.ok ? parsed.value : null;
  if (!response.ok) throw new CliError(errorMessage(value, response.status));
  return value as T | null;
}

export async function isControllerUp(config: Config): Promise<boolean> {
  try {
    const response = await fetch(`${localApiUrl(config)}/v1/health`, { signal: AbortSignal.timeout(1_500) });
    return response.ok;
  } catch {
    return false;
  }
}
