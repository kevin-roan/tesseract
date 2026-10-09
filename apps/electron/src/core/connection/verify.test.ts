import { describe, expect, it } from "vitest";
import { verifyConnection } from "./health";
import { VERIFY_MESSAGES } from "./labels";

const URL = "https://tesseract.example.ts.net";
const HEALTHY = { ok: true, protocolVersion: 1 };

function fetcher(routes: Record<string, (init: RequestInit) => Response>) {
  return async (url: string, init: RequestInit) => {
    const route = routes[url.slice(URL.length)];
    if (!route) throw new TypeError("fetch failed");
    return route(init);
  };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("verifyConnection", () => {
  it("accepts a healthy controller that takes the token", async () => {
    const seen: string[] = [];
    const result = await verifyConnection(URL, "secret", {
      fetcher: fetcher({
        "/v1/health": () => json(HEALTHY),
        "/v1/status": (init) => {
          seen.push(String((init.headers as Record<string, string>).Authorization));
          return json({});
        },
      }),
    });
    expect(result).toEqual({ ok: true });
    expect(seen).toEqual(["Bearer secret"]);
  });

  it("reports a refused token", async () => {
    const result = await verifyConnection(URL, "wrong", {
      fetcher: fetcher({ "/v1/health": () => json(HEALTHY), "/v1/status": () => json({}, 401) }),
    });
    expect(result).toEqual({ ok: false, error: VERIFY_MESSAGES.unauthorized });
  });

  it("reports an unreachable address", async () => {
    expect(await verifyConnection(URL, "secret", { fetcher: fetcher({}) })).toEqual({ ok: false, error: VERIFY_MESSAGES.unreachable(URL) });
  });

  it("rejects servers that are not Tesseract or speak another protocol", async () => {
    const notFound = await verifyConnection(URL, "secret", { fetcher: fetcher({ "/v1/health": () => json({}, 404) }) });
    expect(notFound).toEqual({ ok: false, error: VERIFY_MESSAGES.notTesseract(URL) });
    const other = await verifyConnection(URL, "secret", { fetcher: fetcher({ "/v1/health": () => json({ ok: true, protocolVersion: 99 }) }) });
    expect(other).toEqual({ ok: false, error: VERIFY_MESSAGES.incompatible });
  });
});
