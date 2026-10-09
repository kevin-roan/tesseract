import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ApiError, TesseractClient } from "@tesseract/client";
import type { ProjectStorage } from "@tesseract/protocol";
import { sampleProject } from "@tesseract/protocol/fixtures";

import { sandboxKeys } from "@/features/sandbox/api/query-keys";
import { useProjectStorage } from "@/features/storage/hooks/use-project-storage";
import { clearConfirmation, storageChipLabel, storageRows } from "@/features/storage/utils/content";
import { confirm } from "@/lib/confirm";

import { TEST_SANDBOX, createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../sandbox/helpers";

jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), TesseractClient: jest.fn() }));
jest.mock("expo-router", () => ({ useIsFocused: () => true }));
jest.mock("@/lib/confirm", () => ({ confirm: jest.fn() }));

const MockClient = TesseractClient as unknown as jest.Mock;
const mockConfirm = confirm as jest.Mock;
const PID = sampleProject.id;
const MB = 1024 * 1024;

const STORAGE: ProjectStorage = {
  projectId: PID,
  totalBytes: 6 * MB,
  sourceBytes: MB,
  entries: [
    { category: "dependencies", sizeBytes: 4 * MB, paths: ["node_modules"] },
    { category: "builds", sizeBytes: MB, paths: ["dist"] },
    { category: "caches", sizeBytes: 0, paths: [] },
  ],
  measuredAt: "2026-10-09T10:00:00.000Z",
};
const CLEARED: ProjectStorage = {
  ...STORAGE,
  totalBytes: MB,
  entries: STORAGE.entries.map((entry) => ({ ...entry, sizeBytes: 0, paths: [] })),
};

const fake = { projectStorage: jest.fn(), clearProjectStorage: jest.fn() };

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  mockConfirm.mockReset().mockResolvedValue(true);
  fake.projectStorage.mockReset().mockResolvedValue(STORAGE);
  fake.clearProjectStorage.mockReset().mockResolvedValue(CLEARED);
  MockClient.mockReset().mockImplementation(() => fake);
});

async function renderStorage() {
  const queryClient = createTestQueryClient();
  const rendered = await renderHook(() => useProjectStorage(PID), { wrapper: createWrapper(queryClient) });
  await waitFor(() => expect(rendered.result.current.chipLabel).toBe("6 MB"));
  return { ...rendered, queryClient };
}

describe("useProjectStorage", () => {
  it("clears everything after confirming and reports the freed space", async () => {
    const { result, queryClient } = await renderStorage();
    expect(result.current.canClearAll).toBe(true);
    await act(async () => result.current.clearAll());
    await waitFor(() => expect(result.current.clearedMessage).toBe("Freed 5 MB"));
    expect(fake.clearProjectStorage).toHaveBeenCalledWith(PID, {});
    expect(queryClient.getQueryData(sandboxKeys.projectStorage(TEST_SANDBOX.id, PID))).toEqual(CLEARED);
    expect(result.current.chipLabel).toBe("1 MB");
  });

  it("clears one category and ignores source", async () => {
    const { result } = await renderStorage();
    await act(async () => result.current.clear("source"));
    expect(mockConfirm).not.toHaveBeenCalled();
    await act(async () => result.current.clear("builds"));
    await waitFor(() => expect(fake.clearProjectStorage).toHaveBeenCalledWith(PID, { categories: ["builds"] }));
  });

  it("does nothing when the confirm is dismissed", async () => {
    mockConfirm.mockResolvedValue(false);
    const { result } = await renderStorage();
    await act(async () => result.current.clearAll());
    expect(fake.clearProjectStorage).not.toHaveBeenCalled();
  });

  it("shows why the controller refused", async () => {
    fake.clearProjectStorage.mockRejectedValue(new ApiError(409, "conflict", "Stop process dev in project notes first"));
    const { result } = await renderStorage();
    await act(async () => result.current.clearAll());
    await waitFor(() => expect(result.current.clearError).toBe("Stop process dev in project notes first"));
    expect(result.current.clearedMessage).toBeNull();
  });
});

describe("storage content", () => {
  it("labels the chip while loading and after a failure", () => {
    expect(storageChipLabel(undefined, true)).toBe("Storage…");
    expect(storageChipLabel(undefined, false)).toBe("Storage");
  });

  it("lists source first and only offers clearing folders that exist", () => {
    const rows = storageRows(STORAGE);
    expect(rows.map((row) => [row.id, row.clearable])).toEqual([
      ["source", false],
      ["dependencies", true],
      ["builds", true],
      ["caches", false],
    ]);
  });

  it("explains what each clear deletes", () => {
    expect(clearConfirmation(STORAGE, null)).toMatchObject({ title: "Clear 5 MB?", confirmLabel: "Clear all", destructive: true });
    expect(clearConfirmation(STORAGE, "dependencies").message).toBe("Deletes node_modules (4 MB). Reinstalled by the next run or build.");
  });
});
