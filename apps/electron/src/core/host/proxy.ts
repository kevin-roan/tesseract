import type { HttpResponse } from "@tesseract/client";
import { errorBody } from "@tesseract/protocol";
import type { HttpProxyRequest, HttpProxyResponse } from "../../shared/contracts/http";
import { HOST_PROXY } from "./constants";
import { HOST_LABELS } from "./labels";
import { HostShellError } from "./model";

const UNAUTHORIZED = 401;

function allowedPath(pathname: string): boolean {
  return HOST_PROXY.paths.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxyTarget(rawUrl: string, baseUrl: string): URL {
  let target: URL;
  let base: URL;
  try {
    target = new URL(rawUrl);
    base = new URL(baseUrl);
  } catch {
    throw new HostShellError(HOST_LABELS.proxyForbidden(rawUrl), "invalid_argument");
  }
  if (target.origin !== base.origin || !allowedPath(target.pathname)) {
    throw new HostShellError(HOST_LABELS.proxyForbidden(target.pathname), "forbidden");
  }
  return target;
}

export function proxyHeaders(headers: Record<string, string> | undefined, session: string): Record<string, string> {
  const allowed = new Set<string>(HOST_PROXY.requestHeaders);
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (allowed.has(key.toLowerCase()) && typeof value === "string") result[key] = value;
  }
  result.Authorization = `Bearer ${session}`;
  return result;
}

export function proxyTimeout(timeoutMs: number | undefined): number {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return HOST_PROXY.timeoutMs;
  return Math.min(timeoutMs, HOST_PROXY.maxTimeoutMs);
}

export function lockedResponse(message: string = HOST_LABELS.locked): HttpProxyResponse {
  return {
    status: UNAUTHORIZED,
    statusText: "Unauthorized",
    headers: { "content-type": "application/json" },
    bodyBase64: Buffer.from(JSON.stringify(errorBody("unauthorized", message))).toString("base64"),
  };
}

export function isUnauthorized(response: Pick<HttpProxyResponse, "status">): boolean {
  return response.status === UNAUTHORIZED;
}

export async function toProxyResponse(response: HttpResponse): Promise<HttpProxyResponse> {
  const headers: Record<string, string> = {};
  for (const name of HOST_PROXY.responseHeaders) {
    const value = response.headers.get(name);
    if (value !== null) headers[name] = value;
  }
  const body = Buffer.from(await response.arrayBuffer());
  return { status: response.status, statusText: response.statusText, headers, bodyBase64: body.toString("base64") };
}
