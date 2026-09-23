export type ParseResult<T, C extends string = string> =
  | { ok: true; value: T }
  | { ok: false; error: { code: C; message: string } };

export type ParamValue = string | number | boolean | null | undefined;
export type ParamRecord = Readonly<Record<string, ParamValue>>;

export type BaseUrlErrorCode =
  | "empty"
  | "unsupported_scheme"
  | "credentials_not_allowed"
  | "invalid_host"
  | "invalid_port"
  | "invalid_path";

const BASE_URL_PATTERN = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)/i;
const HOSTNAME_PATTERN = /^(?=.{1,253}$)[a-z0-9_](?:[a-z0-9_-]{0,62})(?:\.[a-z0-9_](?:[a-z0-9_-]{0,62}))*\.?$/;
const IPV6_PATTERN = /^\[[0-9a-f:.]+\]$/;
const API_PATH_NOISE = /\/(?:v\d+|ui)(?:\/.*)?$/i;
const INVALID_PATH_CHARS = /[\s\x00-\x1f\x7f\\]/;
const DEFAULT_PORTS: Readonly<Record<string, string>> = { http: "80", https: "443" };

function fail<C extends string>(code: C, message: string): { ok: false; error: { code: C; message: string } } {
  return { ok: false, error: { code, message } };
}

function encodePairs(params: ParamRecord | undefined): string {
  if (!params) return "";
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return pairs.join("&");
}

export function buildQuery(params?: ParamRecord): string {
  const encoded = encodePairs(params);
  return encoded ? `?${encoded}` : "";
}

export function buildFragment(params?: ParamRecord): string {
  const encoded = encodePairs(params);
  return encoded ? `#${encoded}` : "";
}

export function appendQuery(path: string, params?: ParamRecord): string {
  const encoded = encodePairs(params);
  if (!encoded) return path;
  const hashIndex = path.indexOf("#");
  const base = hashIndex === -1 ? path : path.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? "" : path.slice(hashIndex);
  return `${base}${base.includes("?") ? "&" : "?"}${encoded}${fragment}`;
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** Parses `a=1&b=2` (with or without a leading `?`/`#`). The first occurrence of a key wins; undecodable pairs are skipped. */
export function parseParams(input: string): Record<string, string> {
  const result: Record<string, string> = {};
  const body = input.startsWith("?") || input.startsWith("#") ? input.slice(1) : input;
  if (!body) return result;
  for (const pair of body.split("&")) {
    if (!pair) continue;
    const separator = pair.indexOf("=");
    const rawKey = separator === -1 ? pair : pair.slice(0, separator);
    const rawValue = separator === -1 ? "" : pair.slice(separator + 1);
    const key = safeDecode(rawKey);
    const value = safeDecode(rawValue);
    if (key === null || value === null || Object.prototype.hasOwnProperty.call(result, key)) continue;
    Object.defineProperty(result, key, { value, enumerable: true, writable: true, configurable: true });
  }
  return result;
}

export function parseFragment(hash: string): Record<string, string> {
  return parseParams(hash);
}

export function parseBaseUrl(input: string): ParseResult<string, BaseUrlErrorCode> {
  const trimmed = input.trim();
  if (!trimmed) return fail("empty", "URL is empty");
  const match = BASE_URL_PATTERN.exec(trimmed);
  const scheme = match?.[1]?.toLowerCase();
  if (!match || (scheme !== "http" && scheme !== "https")) {
    return fail("unsupported_scheme", "URL must start with http:// or https://");
  }
  const authority = match[2] ?? "";
  if (authority.includes("@")) {
    return fail("credentials_not_allowed", "URL must not contain credentials");
  }
  const hostPort = /^(.*?)(?::([^:\]]*))?$/.exec(authority);
  const host = (hostPort?.[1] ?? "").toLowerCase();
  const rawPort = hostPort?.[2] || undefined;
  if (!host || !(HOSTNAME_PATTERN.test(host) || IPV6_PATTERN.test(host))) {
    return fail("invalid_host", "URL host is missing or invalid");
  }
  const port = rawPort === undefined ? undefined : Number(rawPort);
  if (port !== undefined && (!/^\d+$/.test(rawPort ?? "") || port < 1 || port > 65535)) {
    return fail("invalid_port", "URL port must be between 1 and 65535");
  }
  const normalizedPort = port === undefined || DEFAULT_PORTS[scheme] === String(port) ? "" : `:${port}`;
  const rawPath = match[3] ?? "";
  if (INVALID_PATH_CHARS.test(rawPath)) {
    return fail("invalid_path", "URL path must not contain spaces, control characters or backslashes");
  }
  const path = rawPath.replace(API_PATH_NOISE, "").replace(/\/+$/, "");
  return { ok: true, value: `${scheme}://${host.replace(/\.$/, "")}${normalizedPort}${path}` };
}

/** Returns the canonical base URL (`http(s)://host[:port][/prefix]`, no trailing slash, no query/fragment, no `/v1…` or `/ui…` suffix) or null. */
export function normalizeBaseUrl(input: string): string | null {
  const result = parseBaseUrl(input);
  return result.ok ? result.value : null;
}

export function toWebSocketUrl(httpUrl: string): string {
  if (/^https:/i.test(httpUrl)) return `wss:${httpUrl.slice(6)}`;
  if (/^http:/i.test(httpUrl)) return `ws:${httpUrl.slice(5)}`;
  return httpUrl;
}
