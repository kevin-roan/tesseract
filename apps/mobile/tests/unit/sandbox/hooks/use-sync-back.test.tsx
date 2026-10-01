import { act, renderHook, waitFor } from "@testing-library/react-native";
import { TheOneClient } from "@theone/client";
import type { SyncRequest } from "@theone/protocol";
import { sampleSyncChanges, sampleSyncRequest } from "@theone/protocol/fixtures";

import { sandboxKeys } from "@/features/sandbox/api/query-keys";
import { useSyncBack } from "@/features/sandbox/hooks/use-sync-back";
import { confirm } from "@/lib/confirm";

import { TEST_SANDBOX, createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../helpers";

jest.mock("@theone/client", () => ({ ...jest.requireActual("@theone/client"), TheOneClient: jest.fn() }));
jest.mock("expo-router", () => ({ useIsFocused: () => true }));
jest.mock("@/lib/confirm", () => ({ confirm: jest.fn() }));

const MockClient = TheOneClient as unknown as jest.Mock;
const mockConfirm = confirm as jest.Mock;
const PROJECT = sampleSyncChanges.projectId;
const pending: SyncRequest = { ...sampleSyncRequest, id: "sync_pending", status: "pending", result: null, claimedBy: null };
const conflicted: SyncRequest = {
  ...sampleSyncRequest,
  id: "sync_conflict",
  status: "failed",
  error: "1 file changed on the host",
  result: { added: 0, modified: 0, deleted: 0, conflicts: ["src/main.ts"], snapshotId: null, hostPath: null },
};
const fake = {
  syncChanges: jest.fn(),
  syncRequests: jest.fn(),
  createSyncRequest: jest.fn(),
  cancelSyncRequest: jest.fn(),
};

async function renderSync() {
  const queryClient = createTestQueryClient();
  const view = await renderHook(() => useSyncBack(PROJECT), { wrapper: createWrapper(queryClient) });
  return { queryClient, ...view };
}

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  mockConfirm.mockReset().mockResolvedValue(true);
  fake.syncChanges.mockReset().mockResolvedValue(sampleSyncChanges);
  fake.syncRequests.mockReset().mockResolvedValue([sampleSyncRequest]);
  fake.createSyncRequest.mockReset().mockResolvedValue(pending);
  fake.cancelSyncRequest.mockReset().mockResolvedValue({ ...pending, status: "cancelled" });
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useSyncBack", () => {
  it("summarises the changes, the host and recent requests", async () => {
    const { result } = await renderSync();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.requests).toHaveLength(1));

    expect(fake.syncChanges).toHaveBeenCalledWith(PROJECT, expect.anything());
    expect(result.current.host).toBe("Monolith on workstation · online");
    expect(result.current.summary).toBe("3 files · 1 added · 1 modified · 1 deleted");
    expect(result.current.files).toHaveLength(3);
    expect(result.current.fileToggleLabel).toBeNull();
    expect(result.current.empty).toBeNull();
    expect(result.current.canSync).toBe(true);
    expect(result.current.canRevert).toBe(true);
    expect(result.current.showForce).toBe(false);
    expect(result.current.requests[0].view.status).toMatch(/^Synced 3 files · /);
  });

  it("confirms and queues a pull for the listed files", async () => {
    const { result, queryClient } = await renderSync();
    await waitFor(() => expect(result.current.requests).toHaveLength(1));

    await act(async () => result.current.openSheet());
    expect(result.current.sheetOpen).toBe(true);
    await act(async () => result.current.submit());

    await waitFor(() => expect(result.current.sheetOpen).toBe(false));
    expect(fake.createSyncRequest).toHaveBeenCalledWith(PROJECT, {
      kind: "pull",
      force: false,
      source: "mobile",
      paths: sampleSyncChanges.changes.map((change) => change.path),
    });
    const cached = queryClient.getQueryData<SyncRequest[]>(sandboxKeys.syncRequests(TEST_SANDBOX.id, PROJECT));
    expect(cached?.map((request) => request.id)).toEqual([pending.id, sampleSyncRequest.id]);
    expect(result.current.canSync).toBe(false);
    expect(result.current.canRevert).toBe(false);
    expect(result.current.requests[0].view).toMatchObject({ cancellable: true });
  });

  it("offers force after a conflict and sends it", async () => {
    fake.syncRequests.mockResolvedValue([conflicted]);
    const { result } = await renderSync();
    await waitFor(() => expect(result.current.showForce).toBe(true));

    await act(async () => result.current.openSheet());
    await act(async () => result.current.setForce(true));
    await act(async () => result.current.submit());
    await waitFor(() => expect(fake.createSyncRequest).toHaveBeenCalled());
    expect(fake.createSyncRequest.mock.calls[0][1]).toMatchObject({ force: true });
    expect(result.current.canRevert).toBe(false);
  });

  it("reverts after confirmation only", async () => {
    const { result } = await renderSync();
    await waitFor(() => expect(result.current.canRevert).toBe(true));

    mockConfirm.mockResolvedValueOnce(false);
    await act(async () => result.current.revert());
    expect(fake.createSyncRequest).not.toHaveBeenCalled();

    await act(async () => result.current.revert());
    await waitFor(() => expect(fake.createSyncRequest).toHaveBeenCalledWith(PROJECT, { kind: "revert", source: "mobile" }));
  });

  it("cancels a pending request", async () => {
    fake.syncRequests.mockResolvedValue([pending]);
    const { result } = await renderSync();
    await waitFor(() => expect(result.current.requests[0]?.view.cancellable).toBe(true));
    expect(result.current.canSync).toBe(false);

    await act(async () => result.current.cancel(pending.id));
    await waitFor(() => expect(result.current.requests[0].view.status).toMatch(/^Cancelled/));
    expect(fake.cancelSyncRequest).toHaveBeenCalledWith(pending.id);
    expect(result.current.canSync).toBe(true);
  });

  it("collapses long change lists", async () => {
    const changes = Array.from({ length: 12 }, (_, index) => ({
      path: `src/f${index}.ts`,
      kind: "added" as const,
      sha256: "d".repeat(64),
      size: 1,
    }));
    fake.syncChanges.mockResolvedValue({ ...sampleSyncChanges, changes });
    const { result } = await renderSync();
    await waitFor(() => expect(result.current.files).toHaveLength(8));
    expect(result.current.fileToggleLabel).toBe("Show all 12 files");

    await act(async () => result.current.toggleExpanded());
    expect(result.current.files).toHaveLength(12);
    expect(result.current.fileToggleLabel).toBe("Show fewer files");
  });

  it("reports load and action errors", async () => {
    fake.syncChanges.mockRejectedValue(new Error("boom"));
    fake.createSyncRequest.mockRejectedValue(new Error("busy"));
    const { result } = await renderSync();
    await waitFor(() => expect(result.current.loadError).not.toBeNull());
    await act(async () => result.current.submit());
    await waitFor(() => expect(result.current.actionError).not.toBeNull());
  });
});
