import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import {
  ClaimDeploySchema,
  CompleteDeploySchema,
  createId,
  CreateDeploySchema,
  DEPLOY_ACTIVE_STATUSES,
  DEPLOY_STATUSES,
  DeployAppNameSchema,
  DeployContainerNameSchema,
  DeployHostnameSchema,
  DeployProgressSchema,
  DeploySchema,
  DeploysQuerySchema,
  DeployTargetsSchema,
  ID_PREFIXES,
  isIdOfKind,
  LIMITS,
  PutDeployTargetsSchema,
  restPaths,
  routePatterns,
  SERVER_EVENT_TYPES,
  ServerEventSchema,
  type Deploy,
} from "../src/index";

const sampleDeploy: Deploy = {
  id: createId("deploy"),
  container: "web",
  app: "shop",
  kind: "compose",
  sourcePath: "/workspace/projects/shop",
  projectId: "shop",
  port: 3000,
  hostname: "shop.example.com",
  create: false,
  cpus: null,
  memoryMb: null,
  status: "deployed",
  sha256: "a".repeat(64),
  bytes: 1234,
  claimedBy: "laptop",
  log: "built\n",
  urls: ["https://shop.example.com"],
  error: null,
  createdAt: "2026-10-24T10:00:00.000Z",
  updatedAt: "2026-10-24T10:01:00.000Z",
};

function roundTrip<T extends z.ZodType>(schema: T, value: unknown) {
  const parsed = schema.parse(JSON.parse(JSON.stringify(value)));
  expect(parsed as unknown).toEqual(value);
  return parsed;
}

function rejects(schema: z.ZodType, value: unknown) {
  expect(schema.safeParse(value).success).toBe(false);
}

describe("deploy routes", () => {
  test("paths", () => {
    expect(restPaths.deploys()).toBe("/v1/deploys");
    expect(restPaths.deploys({ status: "pending", container: "web" })).toBe("/v1/deploys?status=pending&container=web");
    expect(restPaths.deploy("dep_1")).toBe("/v1/deploys/dep_1");
    expect(restPaths.deployTargets()).toBe("/v1/deploys/targets");
    expect(restPaths.deployClaim("dep_1")).toBe("/v1/deploys/dep_1/claim");
    expect(restPaths.deployBundle("dep_1")).toBe("/v1/deploys/dep_1/bundle");
    expect(restPaths.deployProgress("dep_1")).toBe("/v1/deploys/dep_1/progress");
    expect(restPaths.deployComplete("dep_1")).toBe("/v1/deploys/dep_1/complete");
    expect(restPaths.deployCancel("dep_1")).toBe("/v1/deploys/dep_1/cancel");
  });

  test("route patterns", () => {
    expect(routePatterns.rest.deploys).toBe("/v1/deploys");
    expect(routePatterns.rest.deployTargets).toBe("/v1/deploys/targets");
    expect(routePatterns.rest.deploy).toBe("/v1/deploys/:id");
    expect(routePatterns.rest.deployBundle).toBe("/v1/deploys/:id/bundle");
  });

  test("ids, statuses and events", () => {
    expect(ID_PREFIXES.deploy).toBe("dep_");
    expect(isIdOfKind("deploy", sampleDeploy.id)).toBe(true);
    expect(isIdOfKind("deploy", "sync_abc")).toBe(false);
    expect(DEPLOY_ACTIVE_STATUSES.every((status) => DEPLOY_STATUSES.includes(status))).toBe(true);
    expect(SERVER_EVENT_TYPES).toContain("deploy.updated");
    roundTrip(ServerEventSchema, { type: "deploy.updated", deploy: sampleDeploy });
  });
});

describe("deploy names", () => {
  test("container names", () => {
    for (const name of ["web", "my-server", "a1", "a".repeat(32)]) expect(DeployContainerNameSchema.parse(name)).toBe(name);
    for (const name of ["", "a", "1web", "-web", "web-", "Web", "my_server", "a".repeat(33), "tesseract.ct"]) rejects(DeployContainerNameSchema, name);
  });

  test("app names", () => {
    for (const name of ["shop", "0app", "my_app-2", "a", "a".repeat(63)]) expect(DeployAppNameSchema.parse(name)).toBe(name);
    for (const name of ["", "-app", "_app", "App", "my app", "a/b", "a".repeat(64)]) rejects(DeployAppNameSchema, name);
  });

  test("hostnames are trimmed and lowercased", () => {
    expect(DeployHostnameSchema.parse(" Shop.Example.COM ")).toBe("shop.example.com");
    expect(DeployHostnameSchema.parse("a.b.example.dev")).toBe("a.b.example.dev");
    for (const name of ["localhost", "example", "-a.example.com", "a-.example.com", "a..example.com", "a.example.c0m", "a_b.example.com", "http://a.example.com"]) {
      rejects(DeployHostnameSchema, name);
    }
  });
});

describe("deploy schemas", () => {
  test("round-trips", () => {
    roundTrip(DeploySchema, sampleDeploy);
    roundTrip(DeploySchema, { ...sampleDeploy, status: "pending", projectId: null, port: null, hostname: null, claimedBy: null, log: "", urls: [] });
    roundTrip(DeploySchema, { ...sampleDeploy, create: true, cpus: 1.5, memoryMb: 2048 });
    roundTrip(DeployTargetsSchema, { host: null, reportedAt: null, targets: [] });
    roundTrip(DeployTargetsSchema, {
      host: "laptop",
      reportedAt: "2026-10-24T10:00:00.000Z",
      targets: [{ name: "web", running: true, autoApprove: false, urls: ["http://web:8080"] }],
    });
  });

  test("rejects malformed deploys", () => {
    rejects(DeploySchema, { ...sampleDeploy, id: "sync_4k2m9q7x1a" });
    rejects(DeploySchema, { ...sampleDeploy, status: "done" });
    rejects(DeploySchema, { ...sampleDeploy, kind: "helm" });
    rejects(DeploySchema, { ...sampleDeploy, sha256: "xyz" });
    rejects(DeploySchema, { ...sampleDeploy, log: "x".repeat(LIMITS.maxDeployLogLength + 1) });
    rejects(DeploySchema, { ...sampleDeploy, create: undefined });
    rejects(DeploySchema, { ...sampleDeploy, memoryMb: 1024.5 });
  });

  test("hostname requires port", () => {
    const base = { container: "web", path: "/workspace/projects/shop" };
    expect(CreateDeploySchema.parse(base)).toEqual(base);
    expect(CreateDeploySchema.parse({ ...base, app: "shop", port: 3000, hostname: "Shop.Example.com" })).toEqual({
      ...base,
      app: "shop",
      port: 3000,
      hostname: "shop.example.com",
    });
    expect(CreateDeploySchema.parse({ ...base, port: 8080 })).toEqual({ ...base, port: 8080 });
    const missing = CreateDeploySchema.safeParse({ ...base, hostname: "shop.example.com" });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.path).toEqual(["port"]);
    rejects(CreateDeploySchema, { ...base, port: 0 });
    rejects(CreateDeploySchema, { ...base, port: 3000.5 });
    rejects(CreateDeploySchema, { ...base, path: "" });
    rejects(CreateDeploySchema, { ...base, container: "Web" });
    rejects(CreateDeploySchema, { ...base, app: "My App" });
  });

  test("create, cpus and memoryMb", () => {
    const base = { container: "shop", path: "/workspace/projects/shop" };
    expect(CreateDeploySchema.parse({ ...base, create: true })).toEqual({ ...base, create: true });
    expect(CreateDeploySchema.parse({ ...base, create: true, cpus: 2, memoryMb: 4096 })).toEqual({ ...base, create: true, cpus: 2, memoryMb: 4096 });
    expect(CreateDeploySchema.parse({ ...base, create: false })).toEqual({ ...base, create: false });
    for (const extra of [{ cpus: 2 }, { memoryMb: 4096 }, { create: false, cpus: 2 }]) {
      const result = CreateDeploySchema.safeParse({ ...base, ...extra });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(["create"]);
    }
    rejects(CreateDeploySchema, { ...base, create: true, cpus: 0 });
    rejects(CreateDeploySchema, { ...base, create: true, cpus: LIMITS.maxDeployCpus + 1 });
    rejects(CreateDeploySchema, { ...base, create: true, memoryMb: LIMITS.minDeployMemoryMb - 1 });
    rejects(CreateDeploySchema, { ...base, create: true, memoryMb: LIMITS.maxDeployMemoryMb + 1 });
    rejects(CreateDeploySchema, { ...base, create: true, memoryMb: 512.5 });
    rejects(CreateDeploySchema, { ...base, create: "yes" });
  });

  test("host bodies", () => {
    expect(ClaimDeploySchema.parse({ host: " laptop " })).toEqual({ host: "laptop" });
    rejects(ClaimDeploySchema, { host: "" });
    expect(DeployProgressSchema.parse({ status: "deploying", log: "x" })).toEqual({ status: "deploying", log: "x" });
    rejects(DeployProgressSchema, { status: "claimed" });
    rejects(DeployProgressSchema, { status: "deployed" });
    expect(CompleteDeploySchema.parse({ status: "rejected", error: "no" })).toEqual({ status: "rejected", error: "no" });
    rejects(CompleteDeploySchema, { status: "cancelled" });
    rejects(CompleteDeploySchema, { status: "pending" });
    expect(PutDeployTargetsSchema.parse({ host: "laptop", targets: [] })).toEqual({ host: "laptop", targets: [] });
    rejects(PutDeployTargetsSchema, { host: "laptop", targets: [{ name: "Web", running: true, autoApprove: true, urls: [] }] });
    rejects(PutDeployTargetsSchema, { host: " ", targets: [] });
    expect(DeploysQuerySchema.parse({ status: "pending", container: "web" })).toEqual({ status: "pending", container: "web" });
    rejects(DeploysQuerySchema, { status: "bogus" });
  });
});
