import { describe, expect, test } from "bun:test";
import type { RuntimeEntry } from "@tesseract/protocol";
import { sampleAppRun, sampleProcess } from "@tesseract/protocol/fixtures";
import { ProtocolError, TesseractClient, type FetchLike, type HttpRequestInit, type HttpResponse } from "../src/index";

const BASE = "https://tesseract-sandbox.tail1234.ts.net";

const browser: RuntimeEntry = {
  kind: "browser",
  id: "4242",
  name: "Chromium",
  detail: "DevTools 127.0.0.1:9222",
  pid: 4242,
  projectId: null,
  startedAt: "2026-10-19T10:00:00.000Z",
  state: "running",
  cpuPercent: 1.5,
  memoryBytes: 1024,
  supervised: false,
  canStop: true,
};

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
  const calls: { url: string; init: HttpRequestInit }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const parsed = new URL(url);
    return replies[`${init.method} ${parsed.pathname}${parsed.search}`] ?? respond(404, { error: { code: "not_found", message: "nope" } });
  };
  return { client: new TesseractClient({ baseUrl: BASE, token: "token", fetch }), calls };
}

describe("runtime", () => {
  test("lists and stops entries, the signal as a query", async () => {
    const killed = { ...browser, state: "killed", canStop: false, cpuPercent: null, memoryBytes: null };
    const { client, calls } = clientWith({
      "GET /v1/runtime": respond(200, { entries: [browser] }),
      "DELETE /v1/runtime/browser/4242": respond(200, { ...killed, state: "stopped" }),
      "DELETE /v1/runtime/browser/4242?signal=SIGKILL": respond(200, killed),
    });
    expect(await client.runtime()).toEqual({ entries: [browser] });
    expect((await client.stopRuntime("browser", "4242")).state).toBe("stopped");
    expect(await client.stopRuntime("browser", "4242", { signal: "SIGKILL" })).toEqual(killed);
    expect(calls.map((call) => call.init.method)).toEqual(["GET", "DELETE", "DELETE"]);
    await expect(client.stopRuntime("vnc", "session-1")).rejects.toMatchObject({ status: 404 });
  });

  test("stopProcess and stopAppRun take a stop signal and still accept an AbortSignal", async () => {
    const { client, calls } = clientWith({
      [`DELETE /v1/processes/${sampleProcess.id}?signal=SIGKILL`]: respond(200, sampleProcess),
      [`DELETE /v1/processes/${sampleProcess.id}`]: respond(200, sampleProcess),
      [`DELETE /v1/app-runs/${sampleAppRun.id}?signal=SIGKILL`]: respond(200, sampleAppRun),
    });
    await client.stopProcess(sampleProcess.id, { signal: "SIGKILL" });
    await client.stopProcess(sampleProcess.id, { signal: new AbortController().signal });
    await client.stopAppRun(sampleAppRun.id, { signal: "SIGKILL" });
    expect(calls.map((call) => call.url)).toEqual([
      `${BASE}/v1/processes/${sampleProcess.id}?signal=SIGKILL`,
      `${BASE}/v1/processes/${sampleProcess.id}`,
      `${BASE}/v1/app-runs/${sampleAppRun.id}?signal=SIGKILL`,
    ]);
  });

  test("rejects a malformed entry", async () => {
    const { client } = clientWith({ "GET /v1/runtime": respond(200, { entries: [{ ...browser, kind: "daemon" }] }) });
    await expect(client.runtime()).rejects.toBeInstanceOf(ProtocolError);
  });
});
