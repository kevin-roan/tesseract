import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { statSync } from "node:fs";
import { join } from "node:path";
import { ErrorBodySchema, HealthSchema, SandboxStatusSchema, TicketSchema } from "@tesseract/protocol";
import { TicketStore } from "../src/auth/tickets";
import { tokensEqual } from "../src/auth/token";
import { redactUrl } from "../src/http/middleware/request-log";
import { makeTempDir, removeTempDirs, startTestController, TEST_TOKEN, upgradeStatus, WsClient, type TestController } from "./helpers";

let t: TestController;

beforeAll(async () => {
  t = await startTestController({ controller: { ticketTtlMs: 300 } });
});

afterAll(async () => {
  await t.stop();
  removeTempDirs();
});

describe("bearer auth", () => {
  test("health is public", async () => {
    const response = await fetch(`${t.baseUrl}/v1/health`);
    expect(response.status).toBe(200);
    const health = HealthSchema.parse(await response.json());
    expect(health).toMatchObject({ ok: true, protocolVersion: 1, sandboxId: "test-sandbox" });
  });

  test("rejects missing and wrong tokens with a JSON error", async () => {
    const attempts: Record<string, string>[] = [{}, { Authorization: "Bearer nope" }, { Authorization: `Basic ${TEST_TOKEN}` }];
    for (const headers of attempts) {
      const response = await fetch(`${t.baseUrl}/v1/status`, { headers });
      expect(response.status).toBe(401);
      expect(ErrorBodySchema.parse(await response.json()).error.code).toBe("unauthorized");
    }
  });

  test("accepts the bearer token", async () => {
    const { status, body } = await t.json("GET", "/v1/status");
    expect(status).toBe(200);
    const parsed = SandboxStatusSchema.parse(body);
    expect(parsed.sandboxId).toBe("test-sandbox");
    expect(parsed.display.available).toBe(false);
    expect(parsed.tools).toEqual([{ name: "git", version: expect.any(String) }]);
  });

  test("compares tokens in constant time without length leaks", () => {
    expect(tokensEqual(TEST_TOKEN, TEST_TOKEN)).toBe(true);
    expect(tokensEqual(`${TEST_TOKEN}x`, TEST_TOKEN)).toBe(false);
    expect(tokensEqual("", TEST_TOKEN)).toBe(false);
  });

  test("unknown routes return a JSON 404", async () => {
    const { status, body } = await t.json("GET", "/v1/nope");
    expect(status).toBe(404);
    expect(ErrorBodySchema.parse(body).error.code).toBe("not_found");
  });
});

describe("tickets", () => {
  test("are single use for WebSocket upgrades", async () => {
    const ticket = await t.ticket();
    const url = `${t.wsBase}/v1/events?ticket=${ticket}`;
    const first = await WsClient.connect(url);
    await first.waitFor((message: { type: string }) => message.type === "hello");
    first.close();
    const second = await upgradeStatus(url);
    expect(second.status).toBe(401);
    expect(ErrorBodySchema.parse(JSON.parse(second.body)).error.code).toBe("unauthorized");
  });

  test("expire after their TTL", async () => {
    const response = await t.request("POST", "/v1/auth/ticket");
    const ticket = TicketSchema.parse(await response.json());
    expect(Date.parse(ticket.expiresAt)).toBeGreaterThan(Date.now());
    await Bun.sleep(400);
    expect((await upgradeStatus(`${t.wsBase}/v1/events?ticket=${ticket.ticket}`)).status).toBe(401);
  });

  test("are required for every WebSocket", async () => {
    expect((await upgradeStatus(`${t.wsBase}/v1/events`)).status).toBe(401);
    expect((await upgradeStatus(`${t.wsBase}/v1/events?ticket=forged`)).status).toBe(401);
  });

  test("store honours the clock and one-time use", () => {
    let now = 1_000;
    const store = new TicketStore(60_000, () => now);
    const a = store.issue();
    const b = store.issue();
    expect(a.ticket).not.toBe(b.ticket);
    expect(a.ticket).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(store.consume(a.ticket)).toBe(true);
    expect(store.consume(a.ticket)).toBe(false);
    now += 60_001;
    expect(store.consume(b.ticket)).toBe(false);
    expect(store.consume(undefined)).toBe(false);
  });
});

describe("request validation", () => {
  test("rejects invalid JSON", async () => {
    const response = await t.request("POST", "/v1/processes", "{not json");
    expect(response.status).toBe(400);
    const body = ErrorBodySchema.parse(await response.json());
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toContain("JSON");
  });

  test("reports schema errors readably", async () => {
    const { status, body } = await t.json<{ error: { code: string; message: string } }>("POST", "/v1/processes", { command: "" });
    expect(status).toBe(400);
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toContain("projectId");
  });

  test("rejects git option injection and bad project ids", async () => {
    const clone = await t.json<{ error: { code: string } }>("POST", "/v1/projects", { name: "x", gitUrl: "--upload-pack=touch /tmp/pwn" });
    expect(clone.status).toBe(400);
    const project = await t.json<{ error: { code: string } }>("GET", "/v1/projects/..%2F..%2Fetc");
    expect(project.status).toBe(400);
    const query = await t.json<{ error: { code: string } }>("GET", "/v1/processes?projectId=Bad%20Id!");
    expect(query.status).toBe(400);
    const tail = await t.json<{ error: { code: string } }>("GET", "/v1/processes/prc_missing/logs?tail=0");
    expect(tail.status).toBe(400);
  });

  test("unknown ids are 404", async () => {
    expect((await t.json("GET", "/v1/processes/prc_doesnotexist")).status).toBe(404);
    expect((await t.json("GET", "/v1/processes/not-an-id")).status).toBe(404);
    expect((await t.json("GET", "/v1/builds/bld_nothing")).status).toBe(404);
  });

  test("limits request bodies to 1 MiB", async () => {
    const response = await t.request("POST", "/v1/agent/runs", JSON.stringify({ prompt: "x".repeat(1_200_000) }));
    expect(response.status).toBe(413);
    expect(ErrorBodySchema.parse(await response.json()).error.code).toBe("bad_request");
  });

  test("answers CORS preflight without credentials", async () => {
    const response = await fetch(`${t.baseUrl}/v1/status`, {
      method: "OPTIONS",
      headers: { Origin: "http://example.test", "Access-Control-Request-Method": "GET" },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("token file", () => {
  test("is generated with mode 0600 when no token is configured", async () => {
    const workspace = makeTempDir("token");
    const other = await startTestController({ workspace, env: { TESSERACT_TOKEN: undefined } });
    try {
      const file = join(workspace, ".agent", "controller", "token");
      expect(statSync(file).mode & 0o777).toBe(0o600);
      const token = (await Bun.file(file).text()).trim();
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const response = await fetch(`${other.baseUrl}/v1/status`, { headers: { Authorization: `Bearer ${token}` } });
      expect(response.status).toBe(200);
    } finally {
      await other.stop();
    }
  });
});

test("request logs redact tickets", () => {
  expect(redactUrl(new URL("http://x/v1/artifacts/art_1/download?ticket=secret&a=1"))).toBe(
    "/v1/artifacts/art_1/download?ticket=redacted&a=1",
  );
});
