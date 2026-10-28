import { describe, expect, test } from "bun:test";
import { createId, type Deploy, type DeployTargets } from "@tesseract/protocol";
import { ApiError, ProtocolError, TesseractClient, type FetchLike, type HttpRequestInit, type HttpResponse } from "../src/index";

const BASE = "https://tesseract-sandbox.tail1234.ts.net";
const TOKEN = "secret-token";

const sampleDeploy: Deploy = {
  id: createId("deploy"),
  container: "web",
  app: "shop",
  kind: "dockerfile",
  sourcePath: "/workspace/projects/shop",
  projectId: "shop",
  port: 3000,
  hostname: null,
  create: false,
  cpus: null,
  memoryMb: null,
  status: "pending",
  sha256: "b".repeat(64),
  bytes: 3,
  claimedBy: null,
  log: "",
  urls: [],
  error: null,
  createdAt: "2026-10-24T10:00:00.000Z",
  updatedAt: "2026-10-24T10:00:00.000Z",
};
const sampleTargets: DeployTargets = {
  host: "laptop",
  reportedAt: "2026-10-24T10:00:00.000Z",
  targets: [{ name: "web", running: true, autoApprove: true, urls: [] }],
};

type Call = { url: string; init: HttpRequestInit };

function respond(status: number, body: unknown, headers: Record<string, string> = {}): HttpResponse {
  const bytes = body instanceof Uint8Array ? body : new TextEncoder().encode(JSON.stringify(body));
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `status ${status}`,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: async () => new TextDecoder().decode(bytes),
    arrayBuffer: async () => bytes.slice().buffer as ArrayBuffer,
  };
}

function clientWith(replies: Record<string, HttpResponse>) {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const parsed = new URL(url);
    return replies[`${init.method} ${parsed.pathname}${parsed.search}`] ?? respond(404, { error: { code: "not_found", message: "nope" } });
  };
  return { client: new TesseractClient({ baseUrl: BASE, token: TOKEN, fetch }), calls };
}

describe("deploys", () => {
  test("typed methods hit the contract paths", async () => {
    const id = sampleDeploy.id;
    const claimed: Deploy = { ...sampleDeploy, status: "claimed", claimedBy: "laptop" };
    const deploying: Deploy = { ...claimed, status: "deploying", log: "step\n" };
    const deployed: Deploy = { ...deploying, status: "deployed", urls: ["http://web:3000"] };
    const cancelled: Deploy = { ...sampleDeploy, status: "cancelled" };
    const { client, calls } = clientWith({
      "GET /v1/deploys?status=pending&container=web": respond(200, [sampleDeploy]),
      "POST /v1/deploys": respond(201, sampleDeploy),
      [`GET /v1/deploys/${id}`]: respond(200, sampleDeploy),
      "GET /v1/deploys/targets": respond(200, sampleTargets),
      "PUT /v1/deploys/targets": respond(200, sampleTargets),
      [`POST /v1/deploys/${id}/claim`]: respond(200, claimed),
      [`GET /v1/deploys/${id}/bundle`]: respond(200, new Uint8Array([1, 2, 3]), { "x-tesseract-sha256": sampleDeploy.sha256 }),
      [`POST /v1/deploys/${id}/progress`]: respond(200, deploying),
      [`POST /v1/deploys/${id}/complete`]: respond(200, deployed),
      [`POST /v1/deploys/${id}/cancel`]: respond(200, cancelled),
    });
    expect(await client.listDeploys({ status: "pending", container: "web" })).toEqual([sampleDeploy]);
    expect(await client.createDeploy({ container: "web", path: "/workspace/projects/shop", port: 3000, create: true, cpus: 2, memoryMb: 2048 })).toEqual(sampleDeploy);
    expect(await client.getDeploy(id)).toEqual(sampleDeploy);
    expect(await client.deployTargets()).toEqual(sampleTargets);
    expect(await client.putDeployTargets({ host: "laptop", targets: sampleTargets.targets })).toEqual(sampleTargets);
    expect(await client.claimDeploy(id, { host: "laptop" })).toEqual(claimed);
    const bundle = await client.deployBundle(id);
    expect(bundle.sha256).toBe(sampleDeploy.sha256);
    expect([...new Uint8Array(bundle.data)]).toEqual([1, 2, 3]);
    expect(await client.deployProgress(id, { status: "deploying", log: "step\n" })).toEqual(deploying);
    expect(await client.completeDeploy(id, { status: "deployed", urls: ["http://web:3000"] })).toEqual(deployed);
    expect(await client.cancelDeploy(id)).toEqual(cancelled);

    const bodies = Object.fromEntries(calls.filter((call) => call.init.body).map((call) => [`${call.init.method} ${new URL(call.url).pathname}`, JSON.parse(call.init.body!)]));
    expect(bodies).toEqual({
      "POST /v1/deploys": { container: "web", path: "/workspace/projects/shop", port: 3000, create: true, cpus: 2, memoryMb: 2048 },
      "PUT /v1/deploys/targets": { host: "laptop", targets: sampleTargets.targets },
      [`POST /v1/deploys/${id}/claim`]: { host: "laptop" },
      [`POST /v1/deploys/${id}/progress`]: { status: "deploying", log: "step\n" },
      [`POST /v1/deploys/${id}/complete`]: { status: "deployed", urls: ["http://web:3000"] },
    });
    expect(calls.every((call) => call.init.headers.Authorization === `Bearer ${TOKEN}`)).toBe(true);
  });

  test("conflicts and malformed deploys surface as errors", async () => {
    const { client } = clientWith({
      [`POST /v1/deploys/${sampleDeploy.id}/cancel`]: respond(409, { error: { code: "conflict", message: "Deploy is deployed" } }),
      [`GET /v1/deploys/${sampleDeploy.id}`]: respond(200, { ...sampleDeploy, kind: "helm" }),
    });
    const error = await client.cancelDeploy(sampleDeploy.id).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "conflict" });
    await expect(client.getDeploy(sampleDeploy.id)).rejects.toBeInstanceOf(ProtocolError);
  });
});
