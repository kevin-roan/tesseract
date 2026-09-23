import { afterEach, describe, expect, test } from "bun:test";
import { PROTOCOL_VERSION } from "@theone/protocol";
import { sampleDisplay, sampleHealth, sampleProcess, sampleStatus, sampleStatusEvent, sampleTicket } from "@theone/protocol/fixtures";
import {
  AbortError,
  ApiError,
  DEFAULT_EVENTS_IDLE_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS,
  isApiError,
  isAuthError,
  isProtocolVersionError,
  NetworkError,
  ProtocolError,
  ProtocolVersionError,
  protocolVersionMismatch,
  resolveFetch,
  resolveWebSocket,
  TheOneClient,
  TheOneError,
  TimeoutError,
  type FetchLike,
  type HttpRequestInit,
  type HttpResponse,
  type SocketConstructor,
} from "../src/index";

const BASE = "https://sandbox.example";
const TOKEN = "secret";

type Call = { url: string; init: HttpRequestInit };

function response(status: number, text: string, overrides: Partial<HttpResponse> = {}): HttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    headers: { get: () => null },
    text: async () => text,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer as ArrayBuffer,
    ...overrides,
  };
}

function clientWith(handler: (call: Call) => HttpResponse | Promise<HttpResponse>, timeoutMs?: number) {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return handler({ url, init });
  };
  return { client: new TheOneClient({ baseUrl: BASE, token: TOKEN, fetch, timeoutMs }), calls };
}

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error("expected a rejection");
    },
    (error: unknown) => error,
  );

describe("request construction", () => {
  test("GET sends Accept and Authorization but no body or Content-Type", async () => {
    const { client, calls } = clientWith(() => response(200, JSON.stringify(sampleStatus)));
    await client.status();
    const init = calls[0]!.init;
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(init.headers).toEqual({ Accept: "application/json", Authorization: `Bearer ${TOKEN}` });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  test("POST serializes the body as JSON", async () => {
    const { client, calls } = clientWith(() => response(201, JSON.stringify(sampleProcess)));
    await client.startProcess({ projectId: "app", command: "bun dev" });
    const init = calls[0]!.init;
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body ?? "")).toEqual({ projectId: "app", command: "bun dev" });
  });

  test("ids and filters are URL-encoded", async () => {
    const { client, calls } = clientWith(() => response(200, "[]"));
    await client.listProcesses({ projectId: "a b&c" });
    await client.processLogs("prc_../x", { tail: 5 });
    expect(calls[0]!.url).toBe(`${BASE}/v1/processes?projectId=a%20b%26c`);
    expect(calls[1]!.url).toBe(`${BASE}/v1/processes/prc_..%2Fx/logs?tail=5`);
  });

  test("defaults", () => {
    const client = new TheOneClient({ baseUrl: BASE, token: TOKEN, fetch: async () => response(200, "") });
    expect(client.timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
    expect(client.authHeaders()).toEqual({ Authorization: `Bearer ${TOKEN}` });
    expect(DEFAULT_EVENTS_IDLE_TIMEOUT_MS).toBeGreaterThan(2 * 25_000);
  });
});

describe("error bodies", () => {
  test("an error object without a string message falls back to the raw body", async () => {
    const body = JSON.stringify({ error: { code: "conflict", message: 42 } });
    const { client } = clientWith(() => response(409, body));
    const error = (await failure(client.status())) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("conflict");
    expect(error.message).toBe(body);
  });

  test("a non-object error field falls back to the status", async () => {
    const { client } = clientWith(() => response(503, JSON.stringify({ error: "down" })));
    const error = (await failure(client.status())) as ApiError;
    expect(error.code).toBe("unavailable");
    expect(error.status).toBe(503);
  });

  test("a string code that is not an ErrorCode maps from the status", async () => {
    const { client } = clientWith(() => response(429, JSON.stringify({ error: { code: 7, message: "slow down" } })));
    const error = (await failure(client.status())) as ApiError;
    expect(error.code).toBe("bad_request");
    expect(error.message).toBe("slow down");
  });

  test("long bodies are truncated to 300 characters", async () => {
    const { client } = clientWith(() => response(500, `  ${"x".repeat(1_000)}  `));
    const error = (await failure(client.status())) as ApiError;
    expect(error.message).toBe("x".repeat(300));
  });

  test("an empty body uses statusText, then the status number", async () => {
    const withText = clientWith(() => response(502, "", { statusText: "Bad Gateway" }));
    expect(((await failure(withText.client.status())) as ApiError).message).toBe("Bad Gateway");
    const bare = clientWith(() => response(500, "   "));
    expect(((await failure(bare.client.status())) as ApiError).message).toBe("HTTP 500");
  });

  test("a body that cannot be read still yields an ApiError", async () => {
    const { client } = clientWith(() =>
      response(401, "", {
        statusText: "Unauthorized",
        text: () => Promise.reject(new Error("stream reset")),
      }),
    );
    const error = (await failure(client.status())) as ApiError;
    expect(error.code).toBe("unauthorized");
    expect(error.message).toBe("Unauthorized");
    expect(isAuthError(error)).toBe(true);
  });
});

describe("response bodies", () => {
  test("a success body that fails mid-read becomes NetworkError", async () => {
    const { client } = clientWith(() => response(200, "", { text: () => Promise.reject(new TypeError("reset")) }));
    const error = (await failure(client.status())) as NetworkError;
    expect(error).toBeInstanceOf(NetworkError);
    expect(error.message).toContain("/v1/status");
    expect(error.cause).toBeInstanceOf(TypeError);
  });

  test("invalid JSON in a success body is a ProtocolError", async () => {
    const { client } = clientWith(() => response(200, "<html>"));
    const error = (await failure(client.status())) as ProtocolError;
    expect(error).toBeInstanceOf(ProtocolError);
    expect(error.path).toBe("/v1/status");
  });

  test("only health checks the protocol version on schema failures", async () => {
    const other = JSON.stringify({ protocolVersion: PROTOCOL_VERSION + 1 });
    const { client } = clientWith(() => response(200, other));
    const error = await failure(client.status());
    expect(error).toBeInstanceOf(ProtocolError);
    expect(isProtocolVersionError(error)).toBe(false);
  });

  test("a health payload with the right version but a bad shape is a ProtocolError", async () => {
    const { client } = clientWith(() => response(200, JSON.stringify({ ...sampleHealth, sandboxId: 1 })));
    const error = await failure(client.health());
    expect(error).toBeInstanceOf(ProtocolError);
    expect(error).not.toBeInstanceOf(ProtocolVersionError);
  });

  test("publishStatus ignores an unreadable success body", async () => {
    const { client } = clientWith(() => response(202, "", { text: () => Promise.reject(new Error("gone")) }));
    const { ts: _ts, ...event } = sampleStatusEvent;
    await expect(client.publishStatus(event)).resolves.toBeUndefined();
  });
});

describe("timeouts and aborts", () => {
  test("the abort listener is removed after the request settles", async () => {
    const controller = new AbortController();
    let added = 0;
    let removed = 0;
    const signal = controller.signal;
    const add = signal.addEventListener.bind(signal);
    const remove = signal.removeEventListener.bind(signal);
    signal.addEventListener = ((...args: Parameters<typeof add>) => {
      added += 1;
      add(...args);
    }) as typeof signal.addEventListener;
    signal.removeEventListener = ((...args: Parameters<typeof remove>) => {
      removed += 1;
      remove(...args);
    }) as typeof signal.removeEventListener;
    const { client } = clientWith(() => response(200, JSON.stringify(sampleStatus)));
    await client.status({ signal });
    expect([added, removed]).toEqual([1, 1]);
    controller.abort();
  });

  test("an abort after success changes nothing", async () => {
    const controller = new AbortController();
    const { client } = clientWith(() => response(200, JSON.stringify(sampleStatus)));
    const status = await client.status({ signal: controller.signal });
    controller.abort();
    expect(status).toEqual(sampleStatus);
  });

  test("an aborted request aborts the fetch signal and later fetch errors are not leaked", async () => {
    const controller = new AbortController();
    let inner: AbortSignal | undefined;
    const { client } = clientWith(
      ({ init }) =>
        new Promise<HttpResponse>((_, reject) => {
          inner = init.signal;
          init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const pending = failure(client.status({ signal: controller.signal }));
    controller.abort();
    const error = await pending;
    expect(error).toBeInstanceOf(AbortError);
    expect(inner?.aborted).toBe(true);
  });

  test("a pre-aborted signal never calls fetch", async () => {
    const controller = new AbortController();
    controller.abort();
    const { client, calls } = clientWith(() => response(200, "{}"));
    expect(await failure(client.status({ signal: controller.signal }))).toBeInstanceOf(AbortError);
    expect(calls).toHaveLength(0);
  });

  test("per-request timeouts override the client default", async () => {
    const { client } = clientWith(() => new Promise<HttpResponse>(() => undefined), 60_000);
    const error = (await failure(client.status({ timeoutMs: 5 }))) as TimeoutError;
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error.timeoutMs).toBe(5);
    expect(error.message).toContain("5 ms");
  });

  test("a synchronously throwing fetch becomes NetworkError", async () => {
    const client = new TheOneClient({
      baseUrl: BASE,
      token: TOKEN,
      fetch: () => {
        throw "boom";
      },
    });
    const error = (await failure(client.status())) as NetworkError;
    expect(error).toBeInstanceOf(NetworkError);
    expect(error.message).toContain("boom");
  });
});

describe("url helpers", () => {
  test("vncPageUrl omits a null password", async () => {
    const { client } = clientWith(({ url }) =>
      url.endsWith("/auth/ticket")
        ? response(200, JSON.stringify(sampleTicket))
        : response(200, JSON.stringify({ ...sampleDisplay, vnc: { ...sampleDisplay.vnc, password: null } })),
    );
    const url = await client.vncPageUrl();
    expect(url).toBe(`${BASE}/ui/vnc#ticket=${encodeURIComponent(sampleTicket.ticket)}`);
  });

  test("terminalPageUrl encodes the session id", async () => {
    const { client } = clientWith(() => response(200, JSON.stringify(sampleTicket)));
    const url = await client.terminalPageUrl("trm_a&b");
    expect(url).toContain("session=trm_a%26b");
  });

  test("page URLs propagate ticket failures", async () => {
    const { client } = clientWith(() => response(401, JSON.stringify({ error: { code: "unauthorized", message: "no" } })));
    expect(await failure(client.artifactDownloadUrl("art_1"))).toBeInstanceOf(ApiError);
  });

  test("wsUrl keeps a base path prefix", () => {
    const client = new TheOneClient({ baseUrl: "https://host/proxy/", token: TOKEN, fetch: async () => response(200, "") });
    expect(client.wsUrl("/v1/events", "a b")).toBe("wss://host/proxy/v1/events?ticket=a%20b");
    expect(client.httpUrl("/v1/health")).toBe("https://host/proxy/v1/health");
  });
});

describe("streams without a WebSocket", () => {
  const original = (globalThis as { WebSocket?: unknown }).WebSocket;
  afterEach(() => {
    (globalThis as { WebSocket?: unknown }).WebSocket = original;
  });

  test("openEvents reports a missing implementation and closes", async () => {
    (globalThis as { WebSocket?: unknown }).WebSocket = undefined;
    const { client } = clientWith(() => response(200, JSON.stringify(sampleTicket)));
    const errors: TheOneError[] = [];
    const states: string[] = [];
    const connection = client.openEvents({
      onEvent: () => undefined,
      onError: (error) => errors.push(error),
      onStateChange: (state) => states.push(state),
    });
    for (let i = 0; i < 20 && connection.state !== "closed"; i += 1) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(connection.state).toBe("closed");
    expect(errors[0]).toBeInstanceOf(NetworkError);
    expect(states).toEqual(["connecting", "closed"]);
  });
});

describe("errors module", () => {
  test("class hierarchy and names", () => {
    const api = new ApiError(404, "not_found", "missing");
    expect(api).toBeInstanceOf(TheOneError);
    expect(api).toBeInstanceOf(Error);
    expect(api.name).toBe("ApiError");
    const version = new ProtocolVersionError("/v1/health", 2, 1);
    expect(version).toBeInstanceOf(ProtocolError);
    expect(version.name).toBe("ProtocolVersionError");
    expect(version.serverVersion).toBe(2);
    expect(version.clientVersion).toBe(1);
    expect(version.issues).toContain("protocol version 2");
    const cause = new Error("root");
    expect(new ProtocolError("/p", "bad", { cause }).cause).toBe(cause);
    expect(new NetworkError("n", { cause }).cause).toBe(cause);
    expect(new TheOneError("t", { cause }).name).toBe("TheOneError");
    expect(new AbortError("/p").message).toBe("Request to /p was aborted");
  });

  test("type guards", () => {
    const notFound = new ApiError(404, "not_found", "missing");
    expect(isApiError(notFound)).toBe(true);
    expect(isApiError(notFound, "not_found")).toBe(true);
    expect(isApiError(notFound, "conflict")).toBe(false);
    expect(isApiError(new Error("x"))).toBe(false);
    expect(isAuthError(new ApiError(403, "forbidden", "f"))).toBe(true);
    expect(isAuthError(notFound)).toBe(false);
    expect(isAuthError(null)).toBe(false);
    expect(isProtocolVersionError(new ProtocolError("/p", "x"))).toBe(false);
  });

  test("protocolVersionMismatch ignores arrays and non-objects", () => {
    expect(protocolVersionMismatch("/p", "[1]")).toBeNull();
    expect(protocolVersionMismatch("/p", "7")).toBeNull();
    expect(protocolVersionMismatch("/p", "null")).toBeNull();
    expect(protocolVersionMismatch("/p", JSON.stringify({ type: "hello", protocolVersion: "2" }), "hello")).toBeInstanceOf(
      ProtocolVersionError,
    );
    expect(protocolVersionMismatch("/p", JSON.stringify({ type: "ping", protocolVersion: 2 }), "hello")).toBeNull();
  });
});

describe("transport", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("resolveFetch throws a helpful error when there is no global fetch", () => {
    (globalThis as { fetch?: unknown }).fetch = undefined;
    const fetch = resolveFetch();
    expect(() => fetch("http://127.0.0.1", {} as HttpRequestInit)).toThrow(/No fetch implementation/);
  });

  test("resolveFetch prefers the custom implementation", () => {
    const custom: FetchLike = async () => response(200, "");
    expect(resolveFetch(custom)).toBe(custom);
  });

  test("resolveWebSocket prefers custom, then global, then null", () => {
    const custom = class {} as unknown as SocketConstructor;
    expect(resolveWebSocket(custom)).toBe(custom);
    const original = (globalThis as { WebSocket?: unknown }).WebSocket;
    try {
      (globalThis as { WebSocket?: unknown }).WebSocket = undefined;
      expect(resolveWebSocket()).toBeNull();
    } finally {
      (globalThis as { WebSocket?: unknown }).WebSocket = original;
    }
    expect(resolveWebSocket()).toBe(original as SocketConstructor);
  });
});
