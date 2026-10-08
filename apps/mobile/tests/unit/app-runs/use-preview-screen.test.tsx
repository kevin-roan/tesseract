import { renderHook, waitFor } from "@testing-library/react-native";
import { TesseractClient } from "@tesseract/client";
import type { AppRun } from "@tesseract/protocol";
import { sampleAppRun } from "@tesseract/protocol/fixtures";

import { appRunKeys } from "@/features/app-runs/api/query-keys";
import { usePreviewScreen } from "@/features/app-runs/hooks/use-preview-screen";

import { TEST_SANDBOX, createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../sandbox/helpers";

jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), TesseractClient: jest.fn() }));
jest.mock("expo-router", () => ({ useIsFocused: () => true, router: { push: jest.fn(), back: jest.fn() } }));

const MockClient = TesseractClient as unknown as jest.Mock;
const fake = { getAppRun: jest.fn() };
const SID = TEST_SANDBOX.id;
const URL = "http://100.64.0.2:8090";

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  fake.getAppRun.mockReset().mockResolvedValue(sampleAppRun);
  MockClient.mockReset().mockImplementation(() => fake);
});

const renderPreview = (runId: string | undefined, sandboxId: string | undefined, seed?: AppRun) => {
  const queryClient = createTestQueryClient();
  if (seed) queryClient.setQueryData(appRunKeys.list(SID, { projectId: seed.projectId }), [seed]);
  return renderHook(() => usePreviewScreen(runId, sandboxId, "Web"), { wrapper: createWrapper(queryClient) });
};

describe("usePreviewScreen", () => {
  it("resolves the page from the run's url viewer and pins it to that origin", async () => {
    const { result } = await renderPreview(sampleAppRun.id, SID, sampleAppRun);

    expect(result.current.url).toBe(URL);
    expect(result.current.origin).toBe(URL);
    await waitFor(() => expect(fake.getAppRun).toHaveBeenCalledWith(sampleAppRun.id, expect.anything()));
  });

  it("loads a run that is not cached yet", async () => {
    const { result } = await renderPreview(sampleAppRun.id, SID);

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.url).toBe(URL));
    expect(result.current.loading).toBe(false);
  });

  it("shows nothing for a run without a web viewer, another sandbox or a missing id", async () => {
    fake.getAppRun.mockResolvedValue({ ...sampleAppRun, viewer: { kind: "display" } });
    const display = await renderPreview(sampleAppRun.id, SID);
    await waitFor(() => expect(display.result.current.loading).toBe(false));
    expect(display.result.current.url).toBeNull();

    const other = await renderPreview(sampleAppRun.id, "sbx_other", sampleAppRun);
    expect(other.result.current.loading).toBe(false);
    expect(other.result.current.url).toBeNull();

    const missing = await renderPreview(undefined, SID);
    expect(missing.result.current.url).toBeNull();
    expect(fake.getAppRun).toHaveBeenCalledTimes(1);
  });
});
