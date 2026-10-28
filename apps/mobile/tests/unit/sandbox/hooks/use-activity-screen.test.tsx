import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ApiError, TesseractClient } from "@tesseract/client";
import {
  sampleAgentRun,
  sampleBuild,
  sampleClaudeAuthStatus,
  sampleProcess,
  sampleProject,
  sampleStatus,
} from "@tesseract/protocol/fixtures";

import { useActivityScreen } from "@/features/sandbox/hooks/use-activity-screen";

import {
  TEST_IDENTITY,
  createTestQueryClient,
  createWrapper,
  resetSandboxState,
  seedActiveSandbox,
} from "../helpers";

const mockRouter = { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), TesseractClient: jest.fn() }));
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  get router() {
    return mockRouter;
  },
}));

const MockClient = TesseractClient as unknown as jest.Mock;
const fake = {
  identity: jest.fn(),
  status: jest.fn(),
  listProjects: jest.fn(),
  listProcesses: jest.fn(),
  listBuilds: jest.fn(),
  listAgentRuns: jest.fn(),
  claudeAuth: jest.fn(),
};

const renderScreen = () => renderHook(() => useActivityScreen(), { wrapper: createWrapper(createTestQueryClient()) });

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  fake.identity.mockReset().mockResolvedValue(TEST_IDENTITY);
  fake.status.mockReset().mockResolvedValue(sampleStatus);
  fake.listProjects.mockReset().mockResolvedValue([sampleProject]);
  fake.listProcesses.mockReset().mockResolvedValue([{ ...sampleProcess, projectId: null }]);
  fake.listBuilds.mockReset().mockResolvedValue([sampleBuild]);
  fake.listAgentRuns.mockReset().mockResolvedValue([sampleAgentRun]);
  fake.claudeAuth.mockReset().mockResolvedValue(sampleClaudeAuthStatus);
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useActivityScreen", () => {
  it("lists activity that opens the matching screen", async () => {
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.items).toHaveLength(3));
    expect(result.current.loading).toBe(false);

    const byId = (id: string) => result.current.items.find((item) => item.id === id);
    expect(byId(`build-${sampleBuild.id}`)).toMatchObject({ actor: "Ada Lovelace", testID: `activity-build-${sampleBuild.id}` });
    await act(async () => byId(`build-${sampleBuild.id}`)?.onPress?.());
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/sandbox/builds/[id]", params: { id: sampleBuild.id } });
    await act(async () => byId(`run-${sampleAgentRun.id}`)?.onPress?.());
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/sandbox/agent/[id]", params: { id: sampleAgentRun.id } });
    expect(byId(`process-${sampleProcess.id}`)?.onPress).toBeUndefined();
  });

  it("opens a project process from the feed", async () => {
    fake.listProcesses.mockResolvedValue([sampleProcess]);
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.items).toHaveLength(3));
    await act(async () => result.current.items.find((item) => item.id.startsWith("process-"))?.onPress?.());
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/sandbox/projects/[id]",
      params: { id: sampleProject.id, process: sampleProcess.id },
    });
  });

  it("reports a failed activity feed and retries it", async () => {
    fake.listBuilds.mockRejectedValue(new ApiError(500, "internal", "Boom"));
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.error).toBe("Boom"));

    fake.listBuilds.mockResolvedValue([sampleBuild]);
    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.error).toBeNull());
    await waitFor(() => expect(result.current.items.some((item) => item.id === `build-${sampleBuild.id}`)).toBe(true));
  });

  it("has nothing to show without a paired sandbox", async () => {
    resetSandboxState();
    const { result } = await renderScreen();
    expect(result.current.items).toEqual([]);
  });
});
