import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ApiError, NetworkError, TesseractClient } from "@tesseract/client";
import { sampleProject, sampleStatus } from "@tesseract/protocol/fixtures";

import { useSandboxHub } from "@/features/sandbox/hooks/use-sandbox-hub";
import { useConnectionStore } from "@/features/sandbox/store/connection-store";
import { HUB_ACTIONS } from "@/features/sandbox/utils/icons";

import { TEST_SANDBOX, createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../helpers";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), TesseractClient: jest.fn() }));
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  get router() {
    return mockRouter;
  },
}));

const MockClient = TesseractClient as unknown as jest.Mock;
const BUILD = HUB_ACTIONS.find((action) => action.id === "build");
const fake = {
  status: jest.fn(),
  listProjects: jest.fn(),
  listProcesses: jest.fn(),
  listTerminals: jest.fn(),
  listBuilds: jest.fn(),
  listAgentRuns: jest.fn(),
};

const renderHub = () => renderHook(() => useSandboxHub(), { wrapper: createWrapper(createTestQueryClient()) });
const buildAction = (hub: ReturnType<typeof useSandboxHub>) => hub.actions.find((action) => action.id === "build");

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  fake.status.mockReset().mockResolvedValue(sampleStatus);
  fake.listProjects.mockReset().mockResolvedValue([sampleProject]);
  for (const list of [fake.listProcesses, fake.listTerminals, fake.listBuilds, fake.listAgentRuns]) list.mockReset().mockResolvedValue([]);
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useSandboxHub quick actions", () => {
  it("disables Build with a spoken reason while no project has build targets", async () => {
    fake.listProjects.mockResolvedValue([{ ...sampleProject, buildTargets: [] }]);
    const { result } = await renderHub();
    await waitFor(() => expect(result.current.projects).toHaveLength(1));

    expect(buildAction(result.current)).toMatchObject({ disabled: true, accessibilityHint: BUILD?.unavailableHint });
    expect(buildAction(result.current)?.onPress).toBeUndefined();
    for (const action of result.current.actions.filter((entry) => entry.id !== "build")) {
      expect(action.onPress).toEqual(expect.any(Function));
      expect(action.disabled).toBeUndefined();
    }
  });

  it("opens a buildable project from the Build tile", async () => {
    const { result } = await renderHub();
    await waitFor(() => expect(buildAction(result.current)?.onPress).toEqual(expect.any(Function)));

    expect(buildAction(result.current)).toMatchObject({ accessibilityHint: BUILD?.hint });
    expect(buildAction(result.current)?.disabled).toBeUndefined();
    await act(async () => buildAction(result.current)?.onPress?.());
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/sandbox/projects/[id]", params: { id: sampleProject.id } });
  });

  it("routes Add to the new project screen", async () => {
    const { result } = await renderHub();
    await act(async () => result.current.addProject());
    expect(mockRouter.push).toHaveBeenCalledWith("/sandbox/projects/new");
  });
});

describe("useSandboxHub connection problems", () => {
  it("asks to pair again when the controller rejects the token", async () => {
    fake.status.mockRejectedValue(new ApiError(401, "unauthorized", "Missing or invalid credentials"));
    const { result } = await renderHub();
    await waitFor(() => expect(result.current.issue).not.toBeNull());

    expect(result.current.issue).toMatchObject({ title: "Pairing no longer valid", actionLabel: "Pair again" });
    expect(result.current.statusError).toBeNull();
    await act(async () => result.current.repair());
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/pair",
      params: { url: TEST_SANDBOX.baseUrl, name: TEST_SANDBOX.name },
    });
  });

  it("shows a version mismatch reported by the events socket", async () => {
    useConnectionStore.getState().setIssue(TEST_SANDBOX.id, "incompatible");
    const { result } = await renderHub();
    await waitFor(() => expect(result.current.stats.length).toBeGreaterThan(0));
    expect(result.current.issue?.title).toBe("Version mismatch");
  });

  it("keeps a retryable offline message when the controller is unreachable", async () => {
    fake.status.mockRejectedValue(new NetworkError("Network request failed"));
    const { result } = await renderHub();
    await waitFor(() => expect(result.current.statusError).not.toBeNull());
    expect(result.current.statusError).toMatch(/Can't reach the sandbox/);
    expect(result.current.issue).toBeNull();
  });

  it("opens the plain pair screen from the header", async () => {
    const { result } = await renderHub();
    await act(async () => result.current.headerActions.find((action) => action.id === "pair")?.onPress?.());
    expect(mockRouter.push).toHaveBeenCalledWith("/pair");
  });
});
