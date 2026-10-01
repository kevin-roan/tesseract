import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import {
  ClaimSyncRequestSchema,
  CompleteSyncRequestSchema,
  CreateSyncRequestSchema,
  ID_PREFIXES,
  isIdOfKind,
  isSafeSyncPath,
  LIMITS,
  restPaths,
  routePatterns,
  SERVER_EVENT_TYPES,
  ServerEventSchema,
  SyncAckSchema,
  SyncChangesSchema,
  SyncExportSchema,
  SyncHeartbeatSchema,
  SyncPathSchema,
  SyncRequestSchema,
  SyncRequestsQuerySchema,
} from "../src/index";
import { sampleSyncChanges, sampleSyncRequest } from "../src/fixtures";

function roundTrip<T extends z.ZodType>(schema: T, value: unknown) {
  const parsed = schema.parse(JSON.parse(JSON.stringify(value)));
  expect(parsed as unknown).toEqual(value);
  return parsed;
}

function rejects(schema: z.ZodType, value: unknown) {
  expect(schema.safeParse(value).success).toBe(false);
}

describe("sync routes", () => {
  test("paths", () => {
    expect(restPaths.projectSyncChanges("app")).toBe("/v1/projects/app/sync/changes");
    expect(restPaths.projectSyncExport("app")).toBe("/v1/projects/app/sync/export");
    expect(restPaths.projectSyncAck("app")).toBe("/v1/projects/app/sync/ack");
    expect(restPaths.projectSyncRequests("app")).toBe("/v1/projects/app/sync/requests");
    expect(restPaths.syncRequests()).toBe("/v1/sync/requests");
    expect(restPaths.syncRequests({ status: "pending" })).toBe("/v1/sync/requests?status=pending");
    expect(restPaths.syncRequestClaim("sync_1")).toBe("/v1/sync/requests/sync_1/claim");
    expect(restPaths.syncRequestComplete("sync_1")).toBe("/v1/sync/requests/sync_1/complete");
    expect(restPaths.syncRequestCancel("sync_1")).toBe("/v1/sync/requests/sync_1/cancel");
    expect(restPaths.syncHeartbeat()).toBe("/v1/sync/heartbeat");
  });

  test("route patterns", () => {
    expect(routePatterns.rest.projectSyncChanges).toBe("/v1/projects/:id/sync/changes");
    expect(routePatterns.rest.syncRequestClaim).toBe("/v1/sync/requests/:id/claim");
    expect(routePatterns.rest.syncHeartbeat).toBe("/v1/sync/heartbeat");
  });

  test("ids and events", () => {
    expect(ID_PREFIXES.sync).toBe("sync_");
    expect(isIdOfKind("sync", sampleSyncRequest.id)).toBe(true);
    expect(isIdOfKind("sync", "run_abc")).toBe(false);
    expect(SERVER_EVENT_TYPES).toContain("sync.updated");
    expect(SERVER_EVENT_TYPES).toContain("sync.changed");
  });
});

describe("sync paths", () => {
  test("accepts relative POSIX paths", () => {
    for (const path of ["a", "src/main.ts", ".github/workflows/ci.yml", ".gitignore", "a/.gitkeep", "x..y/z"]) {
      expect(isSafeSyncPath(path)).toBe(true);
      expect(SyncPathSchema.parse(path)).toBe(path);
    }
  });

  test("rejects unsafe paths", () => {
    for (const path of ["", "/etc/passwd", "..", "../x", "a/../b", "a/..", "a\\b", ".git", ".git/config", "sub/.git/HEAD", "a//b", "a/", "./a", "a\0b", "x".repeat(LIMITS.maxSyncPathLength + 1)]) {
      expect(isSafeSyncPath(path)).toBe(false);
      rejects(SyncPathSchema, path);
    }
  });
});

describe("sync schemas", () => {
  test("round-trips", () => {
    roundTrip(SyncChangesSchema, sampleSyncChanges);
    roundTrip(SyncChangesSchema, { projectId: "app", baselineAt: null, changes: [], totalBytes: 0, host: null });
    roundTrip(SyncRequestSchema, sampleSyncRequest);
    roundTrip(SyncRequestSchema, { ...sampleSyncRequest, status: "pending", paths: ["src/main.ts"], claimedBy: null, result: null });
  });

  test("rejects malformed values", () => {
    rejects(SyncChangesSchema, { ...sampleSyncChanges, changes: [{ path: "../x", kind: "added", sha256: null, size: null }] });
    rejects(SyncChangesSchema, { ...sampleSyncChanges, changes: [{ path: "a", kind: "renamed", sha256: null, size: null }] });
    rejects(SyncChangesSchema, { ...sampleSyncChanges, changes: [{ path: "a", kind: "added", sha256: "xyz", size: 1 }] });
    rejects(SyncRequestSchema, { ...sampleSyncRequest, id: "inb_4k2m9q7x1a" });
    rejects(SyncRequestSchema, { ...sampleSyncRequest, status: "done" });
    rejects(SyncRequestSchema, { ...sampleSyncRequest, source: "web" });
  });

  test("request bodies", () => {
    expect(CreateSyncRequestSchema.parse({ kind: "revert" })).toEqual({ kind: "revert" });
    expect(CreateSyncRequestSchema.parse({ kind: "pull", paths: ["a"], force: true, source: "cli" })).toEqual({
      kind: "pull",
      paths: ["a"],
      force: true,
      source: "cli",
    });
    rejects(CreateSyncRequestSchema, { kind: "pull", paths: [] });
    rejects(CreateSyncRequestSchema, { kind: "pull", paths: [".git/config"] });
    rejects(CreateSyncRequestSchema, { kind: "push" });
    expect(ClaimSyncRequestSchema.parse({ host: " workstation " })).toEqual({ host: "workstation" });
    rejects(ClaimSyncRequestSchema, { host: "" });
    expect(CompleteSyncRequestSchema.parse({ status: "failed", error: "boom" })).toEqual({ status: "failed", error: "boom" });
    roundTrip(CompleteSyncRequestSchema, { status: "applied", result: sampleSyncRequest.result });
    rejects(CompleteSyncRequestSchema, { status: "cancelled" });
    expect(SyncExportSchema.parse({ paths: ["a/b"] })).toEqual({ paths: ["a/b"] });
    rejects(SyncExportSchema, { paths: [] });
    rejects(SyncExportSchema, { paths: Array.from({ length: LIMITS.maxSyncPaths + 1 }, (_, i) => `f${i}`) });
    roundTrip(SyncAckSchema, { changes: [{ path: "a", sha256: "c".repeat(64) }, { path: "b", sha256: null }] });
    roundTrip(SyncAckSchema, { changes: [{ path: "run.sh", sha256: "c".repeat(64), executable: true }] });
    rejects(SyncAckSchema, { changes: [{ path: "run.sh", sha256: null, executable: "yes" }] });
    rejects(SyncAckSchema, { changes: [{ path: "/abs", sha256: null }] });
    roundTrip(SyncHeartbeatSchema, { host: "workstation", projects: ["app", "electron-hello"] });
    rejects(SyncHeartbeatSchema, { host: "workstation", projects: ["Bad Id"] });
    expect(SyncRequestsQuerySchema.parse({ status: "pending" })).toEqual({ status: "pending" });
    rejects(SyncRequestsQuerySchema, { status: "nope" });
  });

  test("sync events", () => {
    roundTrip(ServerEventSchema, { type: "sync.updated", request: sampleSyncRequest });
    roundTrip(ServerEventSchema, { type: "sync.changed", projectId: "app" });
    rejects(ServerEventSchema, { type: "sync.changed" });
    rejects(ServerEventSchema, { type: "sync.updated", request: { id: "sync_x" } });
  });
});
