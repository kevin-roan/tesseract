import type { FetchLike, HttpRequestInit, HttpResponse } from "@theone/client";
import { httpFixtures } from "./registry";
import { FixtureReply, type HttpFixtureRoute } from "./types";

const FIXTURE_LATENCY_MS = 0;
const encoder = new TextEncoder();

const compiled = new Map<string, RegExp>();

function patternOf(path: string): RegExp {
  let pattern = compiled.get(path);
  if (!pattern) {
    const source = path
      .split("/")
      .map((part) => (part.startsWith(":") ? "([^/]+)" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      .join("/");
    pattern = new RegExp(`^${source}$`);
    compiled.set(path, pattern);
  }
  return pattern;
}

function matchRoute(route: HttpFixtureRoute, method: string, path: string): string[] | null {
  if (route.method !== method) return null;
  const pattern = typeof route.path === "string" ? patternOf(route.path) : route.path;
  const match = pattern.exec(path);
  return match ? match.slice(1).map((value) => decodeURIComponent(value ?? "")) : null;
}

function response(status: number, text: string, contentType: string): HttpResponse {
  const headers = new Map([["content-type", contentType]]);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: { get: (name) => headers.get(name.toLowerCase()) ?? null },
    text: async () => text,
    arrayBuffer: async () => encoder.encode(text).buffer as ArrayBuffer,
  };
}

function parseBody(body: string | undefined): unknown {
  if (body === undefined) return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

export const fixtureFetch: FetchLike = async (url: string, init: HttpRequestInit) => {
  const parsed = new URL(url);
  const method = init.method.toUpperCase();
  if (FIXTURE_LATENCY_MS) await new Promise((resolve) => setTimeout(resolve, FIXTURE_LATENCY_MS));
  for (const route of httpFixtures) {
    const params = matchRoute(route, method, parsed.pathname);
    if (!params) continue;
    const result = await route.respond({ method, path: parsed.pathname, query: parsed.searchParams, params, body: parseBody(init.body) });
    if (result instanceof FixtureReply) {
      const text = typeof result.body === "string" ? result.body : JSON.stringify(result.body ?? null);
      return response(result.status, text, result.contentType);
    }
    return result === undefined ? response(204, "", "text/plain") : response(200, JSON.stringify(result), "application/json");
  }
  const message = `No fixture for ${method} ${parsed.pathname}`;
  return response(404, JSON.stringify({ error: { code: "not_found", message } }), "application/json");
};
