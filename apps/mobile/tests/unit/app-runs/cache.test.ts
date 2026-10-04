import type { AppRun } from "@theone/protocol";
import { sampleAppRun } from "@theone/protocol/fixtures";

import { appRunKeys } from "@/features/app-runs/api/query-keys";
import { cachedAppRun } from "@/features/app-runs/api/cache";
import { applyServerEvent } from "@/features/sandbox/api/cache";

import { createTestQueryClient } from "../sandbox/helpers";

const SID = "sbx_runs";

describe("app.updated", () => {
  it("upserts the run into matching app run lists", () => {
    const client = createTestQueryClient();
    const other: AppRun = { ...sampleAppRun, id: "app_other", projectId: "notes" };
    client.setQueryData(appRunKeys.list(SID, { projectId: sampleAppRun.projectId }), []);
    client.setQueryData(appRunKeys.list(SID, { projectId: "notes" }), [other]);
    client.setQueryData(appRunKeys.list(SID), [other]);

    applyServerEvent(client, SID, { type: "app.updated", run: sampleAppRun });
    expect(client.getQueryData(appRunKeys.list(SID, { projectId: sampleAppRun.projectId }))).toEqual([sampleAppRun]);
    expect(client.getQueryData(appRunKeys.list(SID, { projectId: "notes" }))).toEqual([other]);
    expect(client.getQueryData<AppRun[]>(appRunKeys.list(SID))?.map((run) => run.id)).toEqual([sampleAppRun.id, "app_other"]);

    const stopped: AppRun = { ...sampleAppRun, state: "stopped" };
    applyServerEvent(client, SID, { type: "app.updated", run: stopped });
    expect(client.getQueryData(appRunKeys.list(SID, { projectId: sampleAppRun.projectId }))).toEqual([stopped]);
  });
});

describe("app run detail cache", () => {
  it("finds a run in any list and keeps a loaded detail in step with updates", () => {
    const client = createTestQueryClient();
    client.setQueryData(appRunKeys.list(SID, { projectId: sampleAppRun.projectId }), [sampleAppRun]);
    expect(cachedAppRun(client, SID, sampleAppRun.id)).toEqual(sampleAppRun);
    expect(cachedAppRun(client, SID, "app_missing")).toBeUndefined();

    client.setQueryData(appRunKeys.detail(SID, sampleAppRun.id), sampleAppRun);
    const stopped: AppRun = { ...sampleAppRun, state: "stopped" };
    applyServerEvent(client, SID, { type: "app.updated", run: stopped });
    expect(client.getQueryData(appRunKeys.detail(SID, sampleAppRun.id))).toEqual(stopped);
    expect(client.getQueryData(appRunKeys.detail(SID, "app_other"))).toBeUndefined();
  });
});
