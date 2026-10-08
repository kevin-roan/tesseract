import type { Context } from "hono";
import { isIdOfKind, LIMITS, LogTailQuerySchema, parseJson, ProjectFilterQuerySchema, validate, type IdKind, type Schema } from "@tesseract/protocol";
import { badRequest, notFound } from "../core/errors";

const ID_LABELS: Record<IdKind, string> = {
  process: "Process",
  terminal: "Terminal",
  build: "Build",
  artifact: "Artifact",
  agentRun: "Agent run",
  inbox: "Inbox item",
  upload: "Upload",
  sync: "Sync request",
  appRun: "App run",
  adbStream: "ADB stream",
};

export function parseWith<T>(schema: Schema<T>, data: unknown, what: string): T {
  const result = validate(schema, data);
  if (!result.ok) throw badRequest(`Invalid ${what}: ${result.error.message}`);
  return result.value;
}

export async function jsonBody<T>(c: Context, schema: Schema<T>): Promise<T> {
  return parseBody(await c.req.text(), schema);
}

/** Like `jsonBody`, but an empty body means `fallback`. */
export async function optionalJsonBody<T>(c: Context, schema: Schema<T>, fallback: T): Promise<T> {
  const text = await c.req.text();
  return text.trim() ? parseBody(text, schema) : fallback;
}

function parseBody<T>(text: string, schema: Schema<T>): T {
  const parsed = parseJson(text);
  if (!parsed.ok) throw badRequest(`Request body must be JSON: ${parsed.error.message}`);
  return parseWith(schema, parsed.value, "request body");
}

export function idParam(c: Context, kind: IdKind): string {
  const id = c.req.param("id") ?? "";
  if (!isIdOfKind(kind, id)) throw notFound(`${ID_LABELS[kind]} ${id.slice(0, 80)} not found`);
  return id;
}

export function projectFilter(c: Context): string | undefined {
  return parseWith(ProjectFilterQuerySchema, c.req.query(), "query").projectId;
}

export function logTail(c: Context): number {
  return parseWith(LogTailQuerySchema, c.req.query(), "query").tail ?? LIMITS.defaultLogTail;
}
