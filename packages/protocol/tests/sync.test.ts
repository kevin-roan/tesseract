import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import {
  ClaimSyncRequestSchema,
  CompleteSyncRequestSchema,
  CreateSyncRequestSchema,
  ID_PREFIXES,
  isIdOfKind,
  isSafeSyncGitPath,
  isSafeSyncPath,
  LIMITS,
  restPaths,
  routePatterns,
  SERVER_EVENT_TYPES,
  ServerEventSchema,
  SyncAckSchema,
  SyncChangesSchema,
  SyncExportSchema,
  SyncGetPlanResponseSchema,
  SyncGetPlanSchema,
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
    expect(restPaths.projectSyncDiscard("app")).toBe("/v1/projects/app/sync/discard");
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

describe("get (host → sandbox)", () => {
  const sha = "a".repeat(64);

  test("routes", () => {
    expect(restPaths.syncRequestPlan("sync_7m3k9p2q4r")).toBe("/v1/sync/requests/sync_7m3k9p2q4r/plan");
    expect(restPaths.syncRequestApply("sync_7m3k9p2q4r")).toBe("/v1/sync/requests/sync_7m3k9p2q4r/apply");
    expect(routePatterns.rest.syncRequestPlan).toBe("/v1/sync/requests/:id/plan");
    expect(routePatterns.rest.syncRequestApply).toBe("/v1/sync/requests/:id/apply");
  });

  test(".git paths are relative and stay inside .git", () => {
    for (const path of ["HEAD", "refs/heads/main", "objects/ab/cdef"]) expect(isSafeSyncGitPath(path)).toBe(true);
    for (const path of ["", "/HEAD", "../config", "refs/../../x", "a//b", "./HEAD", "a\\b", "a\0b"]) expect(isSafeSyncGitPath(path)).toBe(false);
  });

  test("plans, responses and get results", () => {
    roundTrip(SyncGetPlanSchema, {
      hostPath: "/home/me/app",
      changes: [
        { path: "src/a.ts", kind: "modified", sha256: sha, executable: false },
        { path: "old.ts", kind: "deleted", sha256: null, executable: false },
      ],
      git: { changed: ["HEAD"], deleted: ["refs/heads/topic"] },
    });
    expect(SyncGetPlanSchema.safeParse({ hostPath: "/x", changes: [{ path: ".git/HEAD", kind: "added", sha256: sha, executable: false }], git: null }).success).toBe(false);
    expect(SyncGetPlanSchema.safeParse({ hostPath: "", changes: [], git: null }).success).toBe(false);
    roundTrip(SyncGetPlanResponseSchema, { request: { ...sampleSyncRequest, kind: "get", status: "claimed" }, upload: ["src/a.ts"], gitUpload: ["HEAD"] });
    roundTrip(SyncRequestSchema, {
      ...sampleSyncRequest,
      kind: "get",
      result: {
        added: 0,
        modified: 1,
        deleted: 0,
        conflicts: [],
        snapshotId: null,
        hostPath: "/home/me/app",
        files: [{ path: "src/a.ts", kind: "modified", insertions: 2, deletions: 1, binary: false, oldMode: "100644", newMode: "100755", oldSize: 10, newSize: 12 }],
        insertions: 2,
        deletions: 1,
        gitFiles: 4,
        syncedAt: "2026-10-01T12:00:00.000Z",
        previousSyncAt: null,
        backupPath: null,
      },
    });
    roundTrip(CreateSyncRequestSchema, { kind: "get", force: true, source: "cli" });
    roundTrip(SyncChangesSchema, { ...sampleSyncChanges, lastGetAt: "2026-10-01T12:00:00.000Z" });
  });
});
