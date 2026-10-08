import { API_PREFIX, parseJson } from "@tesseract/protocol";
import { localApiUrl, type Config } from "../config";
import { CliError, fetchLocalApi, requireToken } from "./local-api";
import type { Output } from "./output";

export const API_METHODS = ["GET", "POST", "DELETE"] as const;
export type ApiMethod = (typeof API_METHODS)[number];

export const API_USAGE = "tesseract-controller api <METHOD> <PATH> [JSON | -]";
export const REDACTED = "***";

const API_TIMEOUT_MS = 120_000;
const API_PATH_PREFIX = `${API_PREFIX}/`;
const STDIN_BODY = "-";

const isApiMethod = (value: string): value is ApiMethod => (API_METHODS as readonly string[]).includes(value);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Replaces every `vnc.password` (DisplayStatus, SandboxStatus.display) so the VNC secret never reaches the agent's output. */
export function redactVncPasswords(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactVncPasswords);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      key === "vnc" && isRecord(entry) && typeof entry.password === "string" ? { ...entry, password: REDACTED } : redactVncPasswords(entry),
    ]),
  );
}

function redactToken(text: string, token: string): string {
  return text.split(token).join(REDACTED);
}

function resolvePath(config: Config, path: string): string {
  if (!path.startsWith(API_PATH_PREFIX)) throw new CliError(`PATH must start with ${API_PATH_PREFIX} (got "${path}")`, 2);
  const base = new URL(localApiUrl(config));
  const url = new URL(path, base);
  if (url.origin !== base.origin || !url.pathname.startsWith(API_PATH_PREFIX)) {
    throw new CliError(`PATH must stay under ${API_PATH_PREFIX} (got "${path}")`, 2);
  }
  return `${url.pathname}${url.search}`;
}

function parseBody(text: string, source: string): string {
  if (!text.trim()) throw new CliError(`The request body from ${source} is empty`, 2);
  const parsed = parseJson(text);
  if (!parsed.ok) throw new CliError(`The request body from ${source} is not valid JSON: ${parsed.error.message}`, 2);
  return JSON.stringify(parsed.value);
}

function isTextual(contentType: string): boolean {
  return contentType === "" || contentType.startsWith("text/") || contentType.includes("json");
}

function renderText(bytes: Uint8Array, contentType: string, token: string): string {
  const text = new TextDecoder().decode(bytes);
  const parsed = contentType.includes("json") || contentType === "" ? parseJson(text) : null;
  const rendered = parsed?.ok ? JSON.stringify(redactVncPasswords(parsed.value), null, 2) : text.replace(/\n$/, "");
  return redactToken(rendered, token);
}

export async function api(config: Config, args: string[], output: Output, readStdin: () => Promise<string>): Promise<number> {
  const [methodArg, pathArg, bodyArg, ...extra] = args;
  if (!methodArg || !pathArg || extra.length > 0) throw new CliError(`Usage: ${API_USAGE}`, 2);
  const method = methodArg.toUpperCase();
  if (!isApiMethod(method)) throw new CliError(`METHOD must be ${API_METHODS.join(", ")} (got "${methodArg}")`, 2);
  const path = resolvePath(config, pathArg);
  if (bodyArg !== undefined && method === "GET") throw new CliError("GET requests take no body", 2);
  const body =
    bodyArg === undefined
      ? undefined
      : bodyArg === STDIN_BODY
        ? parseBody(await readStdin(), "stdin")
        : parseBody(bodyArg, "the command line");

  const token = requireToken(config);
  const response = await fetchLocalApi(config, method, path, body, API_TIMEOUT_MS);
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  const bytes = new Uint8Array(await response.arrayBuffer());

  if (!response.ok) {
    const rendered = bytes.byteLength ? renderText(bytes, contentType, token) : "";
    output.err(rendered || `HTTP ${response.status} ${response.statusText}`.trim());
    return 1;
  }
  if (bytes.byteLength === 0) return 0;
  if (isTextual(contentType)) {
    output.out(renderText(bytes, contentType, token));
    return 0;
  }
  if (!output.raw) {
    throw new CliError(`The response is ${contentType} (${bytes.byteLength} bytes); redirect stdout to a file to save it`);
  }
  await output.raw(bytes);
  return 0;
}
