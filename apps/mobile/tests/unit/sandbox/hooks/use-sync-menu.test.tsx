import { act, renderHook, waitFor } from "@testing-library/react-native";
import { TheOneClient } from "@theone/client";
import type { ServerEvent, SyncChanges, SyncDiscardResult, SyncRequest } from "@theone/protocol";
import { sampleSyncChanges, sampleSyncRequest } from "@theone/protocol/fixtures";

import { applyServerEvent } from "@/features/sandbox/api/cache";
import { useSyncMenu } from "@/features/sandbox/hooks/use-sync-menu";
import { SYNC_COPY } from "@/features/sandbox/utils/sync";
import { confirm } from "@/lib/confirm";

import { TEST_SANDBOX, createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../helpers";

jest.mock("@theone/client", () => ({ ...jest.requireActual("@theone/client"), TheOneClient: jest.fn() }));
jest.mock("expo-router", () => ({ useIsFocused: () => true }));
jest.mock("@/lib/confirm", () => ({ confirm: jest.fn() }));

const MockClient = TheOneClient as unknown as jest.Mock;
const mockConfirm = confirm as jest.Mock;
const PROJECT = sampleSyncChanges.projectId;
const pending: SyncRequest = { ...sampleSyncRequest, id: "sync_pending", status: "pending", result: null, claimedBy: null };
const restorable: SyncChanges = {
  ...sampleSyncChanges,
  changes: sampleSyncChanges.changes.map((change) => ({ ...change, discardable: true })),
};
const discarded: SyncDiscardResult = {
  discarded: restorable.changes.map((change) => change.path),
  unavailable: [],
  backupPath: null,
  changes: { ...restorable, changes: [] },
};
const fake = {
  syncChanges: jest.fn(),
  syncRequests: jest.fn(),
  createSyncRequest: jest.fn(),
  syncDiscard: jest.fn(),
};

async function renderSync(projectId: string | null = PROJECT, active = false) {
  const queryClient = createTestQueryClient();
  const view = await renderHook(({ running }: { running: boolean }) => useSyncMenu(projectId, running), {
    wrapper: createWrapper(queryClient),
    initialProps: { running: active },
  });
  return { queryClient, ...view };
}

const publish = (queryClient: ReturnType<typeof createTestQueryClient>, request: SyncRequest) =>
  act(async () => applyServerEvent(queryClient, TEST_SANDBOX.id, { type: "sync.updated", request } satisfies ServerEvent));

const option = (result: { current: ReturnType<typeof useSyncMenu> }, id: string) =>
  result.current.menu.options.find((candidate) => candidate.id === id)!;

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  mockConfirm.mockReset().mockResolvedValue(true);
  fake.syncChanges.mockReset().mockResolvedValue(restorable);
  fake.syncRequests.mockReset().mockResolvedValue([sampleSyncRequest]);
  fake.createSyncRequest.mockReset().mockResolvedValue(pending);
  fake.syncDiscard.mockReset().mockResolvedValue(discarded);
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useSyncMenu", () => {
  it("has no action without a project", async () => {
    const { result } = await renderSync(null);
    expect(result.current.action).toBeNull();
    expect(result.current.notice).toBeNull();
    expect(fake.syncChanges).not.toHaveBeenCalled();
  });

  it("waits for the changes before offering the menu", async () => {
    fake.syncChanges.mockReturnValue(new Promise(() => undefined));
    const { result } = await renderSync();
    expect(result.current.action).toMatchObject({ id: "sync", label: "Sync", disabled: true });
    expect(result.current.menu.options.every((candidate) => candidate.disabled)).toBe(true);
  });

  it("opens a menu with the four actions once the changes load", async () => {
    const { result } = await renderSync();
    expect(result.current.action).toMatchObject({ id: "sync", label: "Sync" });
    await waitFor(() => expect(result.current.action?.disabled).toBe(false));

    await act(async () => result.current.action?.onPress());
    expect(result.current.menu.visible).toBe(true);
    expect(result.current.menu.options.map(({ id, label, disabled }) => [id, label, disabled])).toEqual([
      ["pull", "Sync to host", false],
      ["get", "Sync from host", false],
      ["revert", "Revert last sync", false],
      ["discard", "Discard changes", false],
    ]);
  });

  it("queues a pull in one tap and follows it to applied", async () => {
    const { result, queryClient } = await renderSync();
    await waitFor(() => expect(result.current.action?.disabled).toBe(false));

    await act(async () => result.current.menu.onSelect("pull"));
    expect(result.current.menu.visible).toBe(false);
    await waitFor(() => expect(result.current.notice).toMatchObject({ tone: "info", title: "Sync queued" }));
    expect(fake.createSyncRequest).toHaveBeenCalledWith(PROJECT, {
      kind: "pull",
      force: false,
      source: "mobile",
      paths: sampleSyncChanges.changes.map((change) => change.path),
    });
    expect(option(result, "get")).toMatchObject({ disabled: true, description: SYNC_COPY.inProgress });

    await publish(queryClient, { ...pending, status: "claimed", claimedBy: "workstation" });
    await waitFor(() => expect(result.current.notice).toMatchObject({ title: "Syncing to host", message: "Applying on workstation…" }));

    await publish(queryClient, { ...sampleSyncRequest, id: pending.id });
    await waitFor(() =>
      expect(result.current.notice).toEqual({ tone: "success", title: "Synced to host", message: "1 added · 1 modified · 1 deleted" }),
    );

    await act(async () => result.current.dismiss());
    expect(result.current.notice).toBeNull();
  });

  it("queues a sync from host in one tap", async () => {
    fake.createSyncRequest.mockResolvedValue({ ...pending, kind: "get" });
    const { result } = await renderSync();
    await waitFor(() => expect(result.current.action?.disabled).toBe(false));
    await act(async () => result.current.menu.onSelect("get"));
    await waitFor(() => expect(result.current.notice?.title).toBe("Sync from host queued"));
    expect(fake.createSyncRequest).toHaveBeenCalledWith(PROJECT, { kind: "get", force: false, source: "mobile" });
  });

  it("confirms a revert once the menu is gone", async () => {
    const { result } = await renderSync();
    await waitFor(() => expect(result.current.action?.disabled).toBe(false));

    await act(async () => result.current.menu.onSelect("revert"));
    expect(mockConfirm).not.toHaveBeenCalled();
    await act(async () => result.current.menu.onDismissed());
    await waitFor(() => expect(fake.createSyncRequest).toHaveBeenCalledWith(PROJECT, { kind: "revert", source: "mobile" }));
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true, confirmLabel: "Revert" }));
  });

  it("discards every restorable file after confirmation and shows the result", async () => {
    const { result } = await renderSync();
    await waitFor(() => expect(result.current.action?.disabled).toBe(false));

    mockConfirm.mockResolvedValueOnce(false);
    await act(async () => result.current.menu.onSelect("discard"));
    await act(async () => result.current.menu.onDismissed());
    expect(fake.syncDiscard).not.toHaveBeenCalled();

    await act(async () => result.current.menu.onSelect("discard"));
    await act(async () => result.current.menu.onDismissed());
    await waitFor(() => expect(result.current.notice?.title).toBe("Discarded sandbox changes"));
    expect(fake.syncDiscard).toHaveBeenCalledWith(PROJECT, { paths: restorable.changes.map((change) => change.path) });
    expect(result.current.notice?.message).toBe("3 files back to the last synced version");
    await waitFor(() => expect(option(result, "discard").description).toBe(SYNC_COPY.nothingToDiscard));
  });

  it("ignores disabled options and reports request errors", async () => {
    fake.syncChanges.mockResolvedValue({ ...restorable, changes: [] });
    fake.createSyncRequest.mockRejectedValue(new Error("offline"));
    const { result } = await renderSync();
    await waitFor(() => expect(option(result, "pull").description).toBe(SYNC_COPY.upToDate));

    await act(async () => result.current.menu.onSelect("pull"));
    expect(fake.createSyncRequest).not.toHaveBeenCalled();

    await act(async () => result.current.menu.onSelect("get"));
    await waitFor(() => expect(result.current.notice).toEqual({ tone: "danger", title: "Sync from host failed", message: "offline" }));
  });

  it("refreshes the changes when the run finishes", async () => {
    const { result, rerender } = await renderSync(PROJECT, true);
    await waitFor(() => expect(result.current.action?.disabled).toBe(false));
    expect(fake.syncChanges).toHaveBeenCalledTimes(1);

    await rerender({ running: false });
    await waitFor(() => expect(fake.syncChanges).toHaveBeenCalledTimes(2));
  });
});
