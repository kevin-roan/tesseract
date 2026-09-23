import { describe, expect, test } from "bun:test";
import { PROTOCOL_VERSION } from "@theone/protocol";
import {
  sampleAgentRun,
  sampleAgentRunDetail,
  sampleArtifact,
  sampleBuild,
  sampleContext,
  sampleDisplay,
  sampleGitDetails,
  sampleHealth,
  sampleLogLine,
  sampleProcess,
  sampleProject,
  sampleStatus,
  sampleTerminal,
  sampleTicket,
} from "@theone/protocol/fixtures";
import {
  AbortError,
  ApiError,
  NetworkError,
  ProtocolError,
  ProtocolVersionError,
  isProtocolVersionError,
  protocolVersionMismatch,
  TheOneClient,
  TimeoutError,
  type FetchLike,
  type HttpRequestInit,
  type HttpResponse,
} from "../src/index";

const BASE = "https://theone-sandbox.tail1234.ts.net";
const TOKEN = "secret-token";

type Call = { url: string; init: HttpRequestInit };

function respond(status: number, body: unknown, headers: Record<string, string> = {}): HttpResponse {
  const text = body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `status ${status}`,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: async () => text,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer as ArrayBuffer,
  };
}

function fakeFetch(handler: (call: Call) => HttpResponse | Promise<HttpResponse>) {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    const call = { url, init };
    calls.push(call);
    return handler(call);
  };
  return { fetch, calls };
}

function clientWith(handler: (call: Call) => HttpResponse | Promise<HttpResponse>, timeoutMs?: number) {
  const fake = fakeFetch(handler);
  return { client: new TheOneClient({ baseUrl: `${BASE}/`, token: TOKEN, fetch: fake.fetch, timeoutMs }), calls: fake.calls };
}

describe("construction", () => {
  test("normalizes the base url", () => {
    const client = new TheOneClient({ baseUrl: " https://Host:443/v1/ ", token: TOKEN, fetch: fakeFetch(() => respond(200, {})).fetch });
    expect(client.baseUrl).toBe("https://host");
    expect(client.timeoutMs).toBe(15_000);
  });

  test("rejects invalid urls and empty tokens", () => {
    expect(() => new TheOneClient({ baseUrl: "host:7700", token: TOKEN })).toThrow(TypeError);
    expect(() => new TheOneClient({ baseUrl: BASE, token: "" })).toThrow(TypeError);
  });
});

describe("REST endpoints", () => {
  const id = "x/y";
  const cases: Array<{
    name: string;
    call: (client: TheOneClient) => Promise<unknown>;
    method: string;
    path: string;
    response: unknown;
    status?: number;
    body?: unknown;
  }> = [
    { name: "createTicket", call: (c) => c.createTicket(), method: "POST", path: "/v1/auth/ticket", response: sampleTicket },
    { name: "status", call: (c) => c.status(), method: "GET", path: "/v1/status", response: sampleStatus },
    { name: "context", call: (c) => c.context(), method: "GET", path: "/v1/context", response: sampleContext },
    { name: "listProjects", call: (c) => c.listProjects(), method: "GET", path: "/v1/projects", response: [sampleProject] },
    {
      name: "createProject",
      call: (c) => c.createProject({ name: "app", gitUrl: "https://github.com/a/b.git" }),
      method: "POST",
      path: "/v1/projects",
      status: 201,
      body: { name: "app", gitUrl: "https://github.com/a/b.git" },
      response: { project: sampleProject, processId: sampleProcess.id },
    },
    { name: "getProject", call: (c) => c.getProject(id), method: "GET", path: "/v1/projects/x%2Fy", response: sampleProject },
    { name: "getProjectGit", call: (c) => c.getProjectGit("app"), method: "GET", path: "/v1/projects/app/git", response: sampleGitDetails },
    { name: "listProcesses", call: (c) => c.listProcesses({ projectId: "app" }), method: "GET", path: "/v1/processes?projectId=app", response: [sampleProcess] },
    {
      name: "startProcess",
      call: (c) => c.startProcess({ projectId: "app", command: ["npm", "start"], display: true }),
      method: "POST",
      path: "/v1/processes",
      status: 201,
      body: { projectId: "app", command: ["npm", "start"], display: true },
      response: sampleProcess,
    },
    { name: "getProcess", call: (c) => c.getProcess("prc_1"), method: "GET", path: "/v1/processes/prc_1", response: sampleProcess },
    { name: "stopProcess", call: (c) => c.stopProcess("prc_1"), method: "DELETE", path: "/v1/processes/prc_1", response: sampleProcess },
    { name: "processLogs", call: (c) => c.processLogs("prc_1", { tail: 20 }), method: "GET", path: "/v1/processes/prc_1/logs?tail=20", response: [sampleLogLine] },
    { name: "listTerminals", call: (c) => c.listTerminals(), method: "GET", path: "/v1/terminals", response: [sampleTerminal] },
    {
      name: "createTerminal",
      call: (c) => c.createTerminal({ kind: "claude", cols: 80, rows: 24 }),
      method: "POST",
      path: "/v1/terminals",
      status: 201,
      body: { kind: "claude", cols: 80, rows: 24 },
      response: sampleTerminal,
    },
    { name: "closeTerminal", call: (c) => c.closeTerminal("trm_1"), method: "DELETE", path: "/v1/terminals/trm_1", response: sampleTerminal },
    { name: "listBuilds", call: (c) => c.listBuilds(), method: "GET", path: "/v1/builds", response: [sampleBuild] },
    {
      name: "startBuild",
      call: (c) => c.startBuild({ projectId: "app", target: "electron-windows" }),
      method: "POST",
      path: "/v1/builds",
      status: 201,
      body: { projectId: "app", target: "electron-windows" },
      response: sampleBuild,
    },
    { name: "getBuild", call: (c) => c.getBuild("bld_1"), method: "GET", path: "/v1/builds/bld_1", response: sampleBuild },
    { name: "cancelBuild", call: (c) => c.cancelBuild("bld_1"), method: "DELETE", path: "/v1/builds/bld_1", response: sampleBuild },
    { name: "buildLogs", call: (c) => c.buildLogs("bld_1"), method: "GET", path: "/v1/builds/bld_1/logs", response: [sampleLogLine] },
    { name: "listArtifacts", call: (c) => c.listArtifacts({ projectId: "app" }), method: "GET", path: "/v1/artifacts?projectId=app", response: [sampleArtifact] },
    { name: "displayStatus", call: (c) => c.displayStatus(), method: "GET", path: "/v1/display", response: sampleDisplay },
    { name: "listAgentRuns", call: (c) => c.listAgentRuns({ projectId: "app" }), method: "GET", path: "/v1/agent/runs?projectId=app", response: [sampleAgentRun] },
    {
      name: "startAgentRun",
      call: (c) => c.startAgentRun({ prompt: "build it", projectId: "app" }),
      method: "POST",
      path: "/v1/agent/runs",
      status: 201,
      body: { prompt: "build it", projectId: "app" },
      response: sampleAgentRun,
    },
    { name: "getAgentRun", call: (c) => c.getAgentRun("run_1"), method: "GET", path: "/v1/agent/runs/run_1", response: sampleAgentRunDetail },
    { name: "cancelAgentRun", call: (c) => c.cancelAgentRun("run_1"), method: "DELETE", path: "/v1/agent/runs/run_1", response: sampleAgentRun },
  ];

  for (const testCase of cases) {
    test(`${testCase.name} → ${testCase.method} ${testCase.path}`, async () => {
      const { client, calls } = clientWith(() => respond(testCase.status ?? 200, testCase.response));
      const result = await testCase.call(client);
      expect(result).toEqual(testCase.response);
      expect(calls).toHaveLength(1);
      const [call] = calls;
      expect(call?.url).toBe(`${BASE}${testCase.path}`);
      expect(call?.init.method).toBe(testCase.method);
      expect(call?.init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
      if (testCase.body === undefined) {
        expect(call?.init.body).toBeUndefined();
        expect(call?.init.headers["Content-Type"]).toBeUndefined();
      } else {
        expect(JSON.parse(call?.init.body ?? "null")).toEqual(testCase.body);
        expect(call?.init.headers["Content-Type"]).toBe("application/json");
      }
    });
  }

  test("health is public", async () => {
    const { client, calls } = clientWith(() => respond(200, sampleHealth));
    expect(await client.health()).toEqual(sampleHealth);
    expect(calls[0]?.url).toBe(`${BASE}/v1/health`);
    expect(calls[0]?.init.headers.Authorization).toBeUndefined();
  });

  test("screenshot returns the raw bytes", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const { client, calls } = clientWith(() => ({
      ...respond(200, undefined, { "content-type": "image/png" }),
      arrayBuffer: async () => png.buffer,
    }));
    const bytes = await client.screenshot();
    expect(bytes).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(bytes)).toEqual(png);
    expect(calls[0]?.url).toBe(`${BASE}/v1/display/screenshot`);
    expect(calls[0]?.init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  test("publishStatus posts the event and resolves on 202", async () => {
    const { client, calls } = clientWith(() => respond(202, undefined));
    const event = { project: "app", status: "building", message: "Packaging" };
    expect(await client.publishStatus(event)).toBeUndefined();
    expect(calls[0]?.url).toBe(`${BASE}/v1/events`);
    expect(calls[0]?.init.method).toBe("POST");
    expect(JSON.parse(calls[0]?.init.body ?? "null")).toEqual(event);
  });
});

describe("error mapping", () => {
  test("ErrorBody becomes ApiError", async () => {
    const { client } = clientWith(() => respond(404, { error: { code: "not_found", message: "No such project: x" } }));
    const error = await client.getProject("x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: "not_found", message: "No such project: x" });
  });

  test("unknown codes fall back to the status mapping but keep the message", async () => {
    const { client } = clientWith(() => respond(429, { error: { code: "rate_limited", message: "slow down" } }));
    const error = await client.status().catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 429, code: "bad_request", message: "slow down" });
  });

  test("non-JSON error bodies", async () => {
    const { client } = clientWith(() => respond(502, "Bad Gateway from proxy"));
    const error = await client.status().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: "unavailable", message: "Bad Gateway from proxy" });

    const empty = await clientWith(() => respond(401, undefined)).client.status().catch((e: unknown) => e);
    expect(empty).toMatchObject({ status: 401, code: "unauthorized", message: "status 401" });
  });

  test("schema mismatches become ProtocolError", async () => {
    const { client } = clientWith(() => respond(200, { ...sampleProcess, state: "zombie" }));
    const error = await client.getProcess("prc_1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProtocolError);
    expect((error as ProtocolError).path).toBe("/v1/processes/prc_1");
    expect((error as ProtocolError).issues).toContain("state");

    const notJson = await clientWith(() => respond(200, "<html>")).client.status().catch((e: unknown) => e);
    expect(notJson).toBeInstanceOf(ProtocolError);

    const version = await clientWith(() => respond(200, { ...sampleHealth, protocolVersion: 2 })).client.health().catch((e: unknown) => e);
    expect(version).toBeInstanceOf(ProtocolError);
  });

  test("a health payload with another protocol version becomes ProtocolVersionError", async () => {
    const newer = await clientWith(() => respond(200, { ...sampleHealth, protocolVersion: 2 })).client.health().catch((e: unknown) => e);
    expect(newer).toBeInstanceOf(ProtocolVersionError);
    expect(isProtocolVersionError(newer)).toBe(true);
    expect(newer).toMatchObject({ serverVersion: 2, clientVersion: PROTOCOL_VERSION, path: "/v1/health" });

    const broken = await clientWith(() => respond(200, { ...sampleHealth, sandboxId: 7 })).client.health().catch((e: unknown) => e);
    expect(broken).toBeInstanceOf(ProtocolError);
    expect(isProtocolVersionError(broken)).toBe(false);

    const status = await clientWith(() => respond(200, { protocolVersion: 2 })).client.status().catch((e: unknown) => e);
    expect(isProtocolVersionError(status)).toBe(false);
  });

  test("protocolVersionMismatch only flags objects that carry a different version", () => {
    expect(protocolVersionMismatch("/v1/health", JSON.stringify(sampleHealth))).toBeNull();
    expect(protocolVersionMismatch("/v1/health", "not json")).toBeNull();
    expect(protocolVersionMismatch("/v1/health", "[2]")).toBeNull();
    expect(protocolVersionMismatch("/v1/health", JSON.stringify({ ok: true }))).toBeNull();
    expect(protocolVersionMismatch("/v1/events", JSON.stringify({ type: "status", protocolVersion: 2 }), "hello")).toBeNull();
    expect(protocolVersionMismatch("/v1/events", JSON.stringify({ type: "hello", protocolVersion: "2" }), "hello")).toMatchObject({
      serverVersion: "2",
    });
  });

  test("fetch rejections become NetworkError", async () => {
    const { client } = clientWith(() => {
      throw new TypeError("Network request failed");
    });
    const error = await client.status().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NetworkError);
    expect((error as NetworkError).message).toContain("Network request failed");
    expect((error as NetworkError).cause).toBeInstanceOf(TypeError);
  });

  test("timeouts abort the request", async () => {
    let signal: AbortSignal | undefined;
    const { client } = clientWith(
      ({ init }) =>
        new Promise<HttpResponse>((_, reject) => {
          signal = init.signal;
          init.signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
      30,
    );
    const started = Date.now();
    const error = await client.status().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TimeoutError);
    expect((error as TimeoutError).timeoutMs).toBe(30);
    expect(signal?.aborted).toBe(true);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  test("timeouts fire even when fetch ignores the signal", async () => {
    const { client } = clientWith(() => new Promise<HttpResponse>(() => undefined));
    const error = await client.status({ timeoutMs: 20 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TimeoutError);
  });

  test("slow bodies count against the timeout", async () => {
    const { client } = clientWith(() => ({
      ...respond(200, sampleStatus),
      text: () => new Promise<string>(() => undefined),
    }));
    const error = await client.status({ timeoutMs: 20 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TimeoutError);
  });

  test("caller abort signals", async () => {
    const controller = new AbortController();
    const { client } = clientWith(() => new Promise<HttpResponse>(() => undefined));
    const pending = client.status({ signal: controller.signal }).catch((e: unknown) => e);
    controller.abort();
    const error = await pending;
    expect(error).toBeInstanceOf(AbortError);
    expect((error as AbortError).name).toBe("AbortError");

    const already = await client.status({ signal: controller.signal }).catch((e: unknown) => e);
    expect(already).toBeInstanceOf(AbortError);
  });
});

describe("url helpers", () => {
  test("wsUrl switches scheme and appends the ticket", () => {
    const secure = new TheOneClient({ baseUrl: BASE, token: TOKEN, fetch: fakeFetch(() => respond(200, {})).fetch });
    expect(secure.wsUrl("/v1/events", "a+b/c")).toBe("wss://theone-sandbox.tail1234.ts.net/v1/events?ticket=a%2Bb%2Fc");
    const plain = new TheOneClient({ baseUrl: "http://127.0.0.1:7700", token: TOKEN, fetch: fakeFetch(() => respond(200, {})).fetch });
    expect(plain.wsUrl("/v1/terminals/trm_1/stream", "t")).toBe("ws://127.0.0.1:7700/v1/terminals/trm_1/stream?ticket=t");
    expect(plain.authHeaders()).toEqual({ Authorization: `Bearer ${TOKEN}` });
    expect(plain.httpUrl("/v1/display/screenshot")).toBe("http://127.0.0.1:7700/v1/display/screenshot");
  });

  function ticketingClient(display = sampleDisplay) {
    let issued = 0;
    return clientWith(({ url }) => {
      if (url.endsWith("/v1/auth/ticket")) {
        issued += 1;
        return respond(200, { ticket: `tk ${issued}`, expiresAt: sampleTicket.expiresAt });
      }
      if (url.endsWith("/v1/display")) return respond(200, display);
      return respond(404, { error: { code: "not_found", message: url } });
    });
  }

  test("terminalPageUrl fetches a fresh ticket per call", async () => {
    const { client, calls } = ticketingClient();
    expect(await client.terminalPageUrl("trm_1")).toBe(`${BASE}/ui/terminal#ticket=tk%201&session=trm_1`);
    expect(await client.terminalPageUrl("trm_1")).toBe(`${BASE}/ui/terminal#ticket=tk%202&session=trm_1`);
    expect(calls.every((call) => call.init.method === "POST")).toBe(true);
  });

  test("vncPageUrl includes the VNC password when there is one", async () => {
    expect(await ticketingClient().client.vncPageUrl()).toBe(`${BASE}/ui/vnc#ticket=tk%201&password=vncpass1`);
    const withoutPassword = ticketingClient({ ...sampleDisplay, vnc: { ...sampleDisplay.vnc, password: null } });
    expect(await withoutPassword.client.vncPageUrl()).toBe(`${BASE}/ui/vnc#ticket=tk%201`);
  });

  test("artifactDownloadUrl", async () => {
    const { client } = ticketingClient();
    expect(await client.artifactDownloadUrl("art_1")).toBe(`${BASE}/v1/artifacts/art_1/download?ticket=tk%201`);
  });
});
