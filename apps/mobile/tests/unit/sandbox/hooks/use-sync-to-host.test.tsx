import { act, renderHook, waitFor } from "@testing-library/react-native";
import { TheOneClient } from "@theone/client";
import type { ServerEvent, SyncRequest } from "@theone/protocol";
import { sampleSyncChanges, sampleSyncRequest } from "@theone/protocol/fixtures";

import { applyServerEvent } from "@/features/sandbox/api/cache";
import { useSyncToHost } from "@/features/sandbox/hooks/use-sync-to-host";
import { SYNC_COPY } from "@/features/sandbox/utils/sync";

import { TEST_SANDBOX, createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../helpers";

jest.mock("@theone/client", () => ({ ...jest.requireActual("@theone/client"), TheOneClient: jest.fn() }));
jest.mock("expo-router", () => ({ useIsFocused: () => true }));

const MockClient = TheOneClient as unknown as jest.Mock;
const PROJECT = sampleSyncChanges.projectId;
const pending: SyncRequest = { ...sampleSyncRequest, id: "sync_pending", status: "pending", result: null, claimedBy: null };
const fake = {
  syncChanges: jest.fn(),
  syncRequests: jest.fn(),
  createSyncRequest: jest.fn(),
};

async function renderSync(projectId: string | null = PROJECT, active = false) {
  const queryClient = createTestQueryClient();
  const view = await renderHook(({ running }: { running: boolean }) => useSyncToHost(projectId, running), {
    wrapper: createWrapper(queryClient),
    initialProps: { running: active },
  });
  return { queryClient, ...view };
}

const publish = (queryClient: ReturnType<typeof createTestQueryClient>, request: SyncRequest) =>
  act(async () => applyServerEvent(queryClient, TEST_SANDBOX.id, { type: "sync.updated", request } satisfies ServerEvent));

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  fake.syncChanges.mockReset().mockResolvedValue(sampleSyncChanges);
  fake.syncRequests.mockReset().mockResolvedValue([sampleSyncRequest]);
  fake.createSyncRequest.mockReset().mockResolvedValue(pending);
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useSyncToHost", () => {
  it("has no action without a project", async () => {
    const { result } = await renderSync(null);
    expect(result.current.action).toBeNull();
    expect(result.current.notice).toBeNull();
    expect(fake.syncChanges).not.toHaveBeenCalled();
  });

  it("queues a pull for the changed files and follows it to applied", async () => {
    const { result, queryClient } = await renderSync();
    expect(result.current.action).toMatchObject({ id: "sync-to-host", label: "Sync to host", disabled: true });
    await waitFor(() => expect(result.current.action?.disabled).toBe(false));
    expect(result.current.action?.hint).toBeUndefined();

    await act(async () => result.current.action?.onPress());
    await waitFor(() => expect(result.current.notice).toMatchObject({ tone: "info", title: "Sync queued" }));
    expect(fake.createSyncRequest).toHaveBeenCalledWith(PROJECT, {
      kind: "pull",
      force: false,
      source: "mobile",
      paths: sampleSyncChanges.changes.map((change) => change.path),
    });
    expect(result.current.notice?.message).toBe(SYNC_COPY.pending);
    expect(result.current.action).toMatchObject({ disabled: true, hint: SYNC_COPY.inProgress });

    await publish(queryClient, { ...pending, status: "claimed", claimedBy: "workstation" });
    await waitFor(() =>
      expect(result.current.notice).toMatchObject({ title: "Syncing to host", message: "Applying on workstation…" }),
    );

    await publish(queryClient, { ...sampleSyncRequest, id: pending.id });
    await waitFor(() =>
      expect(result.current.notice).toEqual({ tone: "success", title: "Synced to host", message: "1 added · 1 modified · 1 deleted" }),
    );

    await act(async () => result.current.dismiss());
    expect(result.current.notice).toBeNull();
  });

  it("says a queued request waits for an offline companion", async () => {
    fake.syncChanges.mockResolvedValue({ ...sampleSyncChanges, host: { ...sampleSyncChanges.host!, online: false } });
    const { result } = await renderSync();
    await waitFor(() => expect(result.current.action?.disabled).toBe(false));
    await act(async () => result.current.action?.onPress());
    await waitFor(() => expect(result.current.notice?.message).toBe(SYNC_COPY.offline));
  });

  it("reports conflicts and request errors", async () => {
    const { result, queryClient } = await renderSync();
    await waitFor(() => expect(result.current.action?.disabled).toBe(false));
    await act(async () => result.current.action?.onPress());
    await waitFor(() => expect(result.current.notice).not.toBeNull());

    await publish(queryClient, {
      ...pending,
      status: "failed",
      error: "1 file changed on the host",
      result: { added: 0, modified: 0, deleted: 0, conflicts: ["src/main.ts"], snapshotId: null, hostPath: null },
    });
    await waitFor(() =>
      expect(result.current.notice).toEqual({
        tone: "danger",
        title: "Sync failed",
        message: "1 file changed on the host\nConflicts: src/main.ts",
      }),
    );

    fake.createSyncRequest.mockRejectedValue(new Error("offline"));
    await act(async () => result.current.action?.onPress());
    await waitFor(() => expect(result.current.notice).toEqual({ tone: "danger", title: "Sync failed", message: "offline" }));
  });

  it.each([
    [{ ...sampleSyncChanges, baselineAt: null, changes: [] }, SYNC_COPY.neverPushed],
    [{ ...sampleSyncChanges, changes: [] }, SYNC_COPY.upToDate],
  ])("disables the action with a reason when there is nothing to sync", async (changes, hint) => {
    fake.syncChanges.mockResolvedValue(changes);
    const { result } = await renderSync();
    await waitFor(() => expect(result.current.action?.hint).toBe(hint));
    expect(result.current.action?.disabled).toBe(true);
  });

  it("disables the action while another request is active", async () => {
    fake.syncRequests.mockResolvedValue([pending]);
    const { result } = await renderSync();
    await waitFor(() => expect(result.current.action?.hint).toBe(SYNC_COPY.inProgress));
    expect(result.current.action?.disabled).toBe(true);
  });

  it("refreshes the changes when the run finishes", async () => {
    const { result, rerender } = await renderSync(PROJECT, true);
    await waitFor(() => expect(result.current.action?.disabled).toBe(false));
    expect(fake.syncChanges).toHaveBeenCalledTimes(1);

    await rerender({ running: false });
    await waitFor(() => expect(fake.syncChanges).toHaveBeenCalledTimes(2));
  });
});
