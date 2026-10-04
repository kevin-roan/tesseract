import { describe, expect, test } from "bun:test";
import { sampleAppRun, sampleRunTargets, sampleSandboxAndroidStatus } from "@theone/protocol/fixtures";
import { ProtocolError, TheOneClient, type FetchLike, type HttpRequestInit, type HttpResponse } from "../src/index";

const BASE = "https://theone-sandbox.tail1234.ts.net";
const TOKEN = "secret-token";

type Call = { url: string; init: HttpRequestInit };

function respond(status: number, body: unknown): HttpResponse {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `status ${status}`,
    headers: { get: () => null },
    text: async () => text,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer as ArrayBuffer,
  };
}

function clientWith(replies: Record<string, HttpResponse>) {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const parsed = new URL(url);
    return replies[`${init.method} ${parsed.pathname}${parsed.search}`] ?? respond(404, { error: { code: "not_found", message: "nope" } });
  };
  return { client: new TheOneClient({ baseUrl: BASE, token: TOKEN, fetch }), calls };
}

describe("app runs", () => {
  test("typed methods hit the contract paths", async () => {
    const stopped = { ...sampleAppRun, state: "stopped", endedAt: sampleAppRun.readyAt };
    const { client, calls } = clientWith({
      "GET /v1/projects/flutter-hello/run-targets": respond(200, sampleRunTargets),
      "GET /v1/app-runs?projectId=flutter-hello": respond(200, [sampleAppRun]),
      "POST /v1/projects/flutter-hello/app-runs": respond(201, sampleAppRun),
      [`GET /v1/app-runs/${sampleAppRun.id}`]: respond(200, sampleAppRun),
      [`POST /v1/app-runs/${sampleAppRun.id}/actions`]: respond(200, sampleAppRun),
      [`DELETE /v1/app-runs/${sampleAppRun.id}`]: respond(200, stopped),
      "GET /v1/android": respond(200, sampleSandboxAndroidStatus),
    });
    expect(await client.listRunTargets("flutter-hello")).toEqual(sampleRunTargets);
    expect(await client.listAppRuns({ projectId: "flutter-hello" })).toEqual([sampleAppRun]);
    expect(await client.startAppRun("flutter-hello", { target: "flutter-web" })).toEqual(sampleAppRun);
    expect(await client.getAppRun(sampleAppRun.id)).toEqual(sampleAppRun);
    expect(await client.appRunAction(sampleAppRun.id, "reload")).toEqual(sampleAppRun);
    expect((await client.stopAppRun(sampleAppRun.id)).state).toBe("stopped");
    expect(await client.getAndroidStatus()).toEqual(sampleSandboxAndroidStatus);
    expect(JSON.parse(calls[2]?.init.body ?? "{}")).toEqual({ target: "flutter-web" });
    expect(JSON.parse(calls[4]?.init.body ?? "{}")).toEqual({ action: "reload" });
  });

  test("malformed runs are rejected", async () => {
    const { client } = clientWith({ [`GET /v1/app-runs/${sampleAppRun.id}`]: respond(200, { ...sampleAppRun, target: "ios" }) });
    await expect(client.getAppRun(sampleAppRun.id)).rejects.toBeInstanceOf(ProtocolError);
  });
});
