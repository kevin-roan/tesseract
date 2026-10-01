import type { AgentRunDetail, BuildJob, ProcessInfo, StatusEvent, SyncRequest } from "@theone/protocol";
import {
  sampleAgentRun,
  sampleAgentRunDetail,
  sampleArtifact,
  sampleBuild,
  sampleProcess,
  sampleProject,
  sampleStatusEvent,
  sampleSyncChanges,
  sampleSyncRequest,
  sampleTerminal,
} from "@theone/protocol/fixtures";

import { applyServerEvent, resyncSandbox } from "@/features/sandbox/api/cache";
import { sandboxKeys } from "@/features/sandbox/api/query-keys";

import { createTestQueryClient } from "../helpers";

const SID = "sbx_cache";

describe("applyServerEvent", () => {
  it("patches every process list whose filter matches", () => {
    const client = createTestQueryClient();
    const otherProject: ProcessInfo = { ...sampleProcess, id: "prc_other", projectId: "notes" };
    client.setQueryData(sandboxKeys.processes(SID), [otherProject]);
    client.setQueryData(sandboxKeys.processes(SID, { projectId: "electron-hello" }), []);
    client.setQueryData(sandboxKeys.processes(SID, { projectId: "notes" }), [otherProject]);

    applyServerEvent(client, SID, { type: "process.updated", process: sampleProcess });

    expect(client.getQueryData<ProcessInfo[]>(sandboxKeys.processes(SID))?.map((p) => p.id)).toEqual([
      sampleProcess.id,
      "prc_other",
    ]);
    expect(client.getQueryData(sandboxKeys.processes(SID, { projectId: "electron-hello" }))).toEqual([sampleProcess]);
    expect(client.getQueryData(sandboxKeys.processes(SID, { projectId: "notes" }))).toEqual([otherProject]);
  });

  it("updates a process in place when it changes state", () => {
    const client = createTestQueryClient();
    client.setQueryData(sandboxKeys.processes(SID), [sampleProcess]);

    applyServerEvent(client, SID, { type: "process.updated", process: { ...sampleProcess, state: "exited", exitCode: 0 } });

    expect(client.getQueryData<ProcessInfo[]>(sandboxKeys.processes(SID))).toEqual([
      { ...sampleProcess, state: "exited", exitCode: 0 },
    ]);
  });

  it("does not create list caches that were never fetched", () => {
    const client = createTestQueryClient();
    applyServerEvent(client, SID, { type: "terminal.updated", terminal: sampleTerminal });
    expect(client.getQueryData(sandboxKeys.terminals(SID))).toBeUndefined();
  });

  it("stores build updates in the detail and the lists", () => {
    const client = createTestQueryClient();
    const running: BuildJob = { ...sampleBuild, state: "running", stage: "package", progress: 0.5, artifacts: [] };
    client.setQueryData(sandboxKeys.builds(SID), [running]);

    applyServerEvent(client, SID, { type: "build.updated", build: { ...running, state: "succeeded", progress: 1 } });

    expect(client.getQueryData<BuildJob>(sandboxKeys.build(SID, running.id))?.state).toBe("succeeded");
    expect(client.getQueryData<BuildJob[]>(sandboxKeys.builds(SID))?.[0].progress).toBe(1);
  });

  it("adds new artifacts to artifact lists and their build", () => {
    const client = createTestQueryClient();
    client.setQueryData(sandboxKeys.artifacts(SID, { projectId: "electron-hello" }), []);
    client.setQueryData(sandboxKeys.build(SID, sampleBuild.id), { ...sampleBuild, artifacts: [] });

    applyServerEvent(client, SID, { type: "artifact.created", artifact: sampleArtifact });
    applyServerEvent(client, SID, { type: "artifact.created", artifact: sampleArtifact });

    expect(client.getQueryData(sandboxKeys.artifacts(SID, { projectId: "electron-hello" }))).toEqual([sampleArtifact]);
    expect(client.getQueryData<BuildJob>(sandboxKeys.build(SID, sampleBuild.id))?.artifacts).toEqual([sampleArtifact]);
  });

  it("drops deleted artifacts from every list and from their build", () => {
    const client = createTestQueryClient();
    const shared = { ...sampleArtifact, id: "art_shared", buildId: null, source: "agent" as const };
    client.setQueryData(sandboxKeys.artifacts(SID), [shared, sampleArtifact]);
    client.setQueryData(sandboxKeys.artifacts(SID, { projectId: "electron-hello" }), [sampleArtifact]);
    client.setQueryData(sandboxKeys.build(SID, sampleBuild.id), sampleBuild);

    applyServerEvent(client, SID, { type: "artifact.deleted", id: sampleArtifact.id });

    expect(client.getQueryData(sandboxKeys.artifacts(SID))).toEqual([shared]);
    expect(client.getQueryData(sandboxKeys.artifacts(SID, { projectId: "electron-hello" }))).toEqual([]);
    expect(client.getQueryData<BuildJob>(sandboxKeys.build(SID, sampleBuild.id))?.artifacts).toEqual([]);
  });

  it("merges agent run updates without losing streamed events", () => {
    const client = createTestQueryClient();
    client.setQueryData(sandboxKeys.agentRun(SID, sampleAgentRun.id), sampleAgentRunDetail);
    client.setQueryData(sandboxKeys.agentRuns(SID), [sampleAgentRun]);

    const finished = { ...sampleAgentRun, state: "succeeded" as const, usage: { inputTokens: 8000, outputTokens: 4300, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 12_300 }, result: "Done" };
    applyServerEvent(client, SID, { type: "agent.updated", run: finished });

    const detail = client.getQueryData<AgentRunDetail>(sandboxKeys.agentRun(SID, sampleAgentRun.id));
    expect(detail?.state).toBe("succeeded");
    expect(detail?.events).toEqual(sampleAgentRunDetail.events);
    expect(client.getQueryData(sandboxKeys.agentRuns(SID))).toEqual([finished]);
  });

  it("drops archived and deleted agent runs from lists", () => {
    const client = createTestQueryClient();
    const other = { ...sampleAgentRun, id: "run_z9y8x7w6v5" };
    client.setQueryData(sandboxKeys.agentRun(SID, sampleAgentRun.id), sampleAgentRunDetail);
    client.setQueryData(sandboxKeys.agentRuns(SID), [sampleAgentRun, other]);

    applyServerEvent(client, SID, { type: "agent.updated", run: { ...other, state: "succeeded", archivedAt: sampleAgentRun.startedAt } });
    expect(client.getQueryData(sandboxKeys.agentRuns(SID))).toEqual([sampleAgentRun]);

    applyServerEvent(client, SID, { type: "agent.deleted", ids: [sampleAgentRun.id] });
    expect(client.getQueryData(sandboxKeys.agentRuns(SID))).toEqual([]);
    expect(client.getQueryData(sandboxKeys.agentRun(SID, sampleAgentRun.id))).toBeUndefined();
  });

  it("does not seed agent run details from events alone", () => {
    const client = createTestQueryClient();
    applyServerEvent(client, SID, { type: "agent.updated", run: sampleAgentRun });
    expect(client.getQueryData(sandboxKeys.agentRun(SID, sampleAgentRun.id))).toBeUndefined();
  });

  it("updates projects and refreshes their git details", async () => {
    const client = createTestQueryClient();
    client.setQueryData(sandboxKeys.projects(SID), []);
    client.setQueryData(sandboxKeys.projectGit(SID, sampleProject.id), { branch: "main", ahead: 0, behind: 0, files: [], log: [] });

    applyServerEvent(client, SID, { type: "project.updated", project: sampleProject });

    expect(client.getQueryData(sandboxKeys.projects(SID))).toEqual([sampleProject]);
    expect(client.getQueryData(sandboxKeys.project(SID, sampleProject.id))).toEqual(sampleProject);
    expect(client.getQueryState(sandboxKeys.projectGit(SID, sampleProject.id))?.isInvalidated).toBe(true);
  });

  it("keeps the latest agent status events first", () => {
    const client = createTestQueryClient();
    const second: StatusEvent = { ...sampleStatusEvent, status: "done", message: "Installer ready" };

    applyServerEvent(client, SID, { type: "status", event: sampleStatusEvent });
    applyServerEvent(client, SID, { type: "status", event: second });

    expect(client.getQueryData(sandboxKeys.activity(SID))).toEqual([second, sampleStatusEvent]);
  });

  it("patches the project's sync requests and refreshes its changes", async () => {
    const client = createTestQueryClient();
    const projectId = sampleSyncRequest.projectId;
    const pending: SyncRequest = { ...sampleSyncRequest, id: "sync_pending", status: "pending", result: null };
    client.setQueryData(sandboxKeys.syncRequests(SID, projectId), [sampleSyncRequest]);
    client.setQueryData(sandboxKeys.syncRequests(SID, "notes"), []);
    client.setQueryData(sandboxKeys.syncChanges(SID, projectId), sampleSyncChanges);

    applyServerEvent(client, SID, { type: "sync.updated", request: pending });
    applyServerEvent(client, SID, { type: "sync.updated", request: { ...pending, status: "claimed" } });
    expect(client.getQueryData<SyncRequest[]>(sandboxKeys.syncRequests(SID, projectId))?.map((r) => [r.id, r.status])).toEqual([
      ["sync_pending", "claimed"],
      [sampleSyncRequest.id, "applied"],
    ]);
    expect(client.getQueryData(sandboxKeys.syncRequests(SID, "notes"))).toEqual([]);

    applyServerEvent(client, SID, { type: "sync.changed", projectId });
    await Promise.resolve();
    expect(client.getQueryState(sandboxKeys.syncChanges(SID, projectId))?.isInvalidated).toBe(true);
  });

  it("ignores pings and hellos", () => {
    const client = createTestQueryClient();
    applyServerEvent(client, SID, { type: "ping" });
    applyServerEvent(client, SID, { type: "hello", protocolVersion: 1, sandboxId: "x" });
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});

describe("resyncSandbox", () => {
  it("invalidates settled data queries but leaves page tickets and activity alone", async () => {
    const client = createTestQueryClient();
    client.setQueryData(sandboxKeys.status(SID), { ok: true });
    client.setQueryData(sandboxKeys.identity(SID), { sandboxId: SID });
    client.setQueryData(sandboxKeys.page(SID, "vnc", null), "https://host/ui/vnc#ticket=1");
    client.setQueryData(sandboxKeys.activity(SID), []);
    client.setQueryData(sandboxKeys.status("sbx_other"), { ok: true });

    await resyncSandbox(client, SID);

    expect(client.getQueryState(sandboxKeys.status(SID))?.isInvalidated).toBe(true);
    expect(client.getQueryState(sandboxKeys.identity(SID))?.isInvalidated).toBe(true);
    expect(client.getQueryState(sandboxKeys.page(SID, "vnc", null))?.isInvalidated).toBe(false);
    expect(client.getQueryState(sandboxKeys.activity(SID))?.isInvalidated).toBe(false);
    expect(client.getQueryState(sandboxKeys.status("sbx_other"))?.isInvalidated).toBe(false);
  });
});
