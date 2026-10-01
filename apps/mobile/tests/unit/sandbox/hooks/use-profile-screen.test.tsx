import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ApiError, NetworkError, TheOneClient } from "@theone/client";
import {
  sampleAgentRun,
  sampleBuild,
  sampleClaudeAuthStatus,
  sampleProcess,
  sampleProject,
  sampleStatus,
} from "@theone/protocol/fixtures";

import { useProfileScreen } from "@/features/sandbox/hooks/use-profile-screen";

import {
  NO_TAILSCALE,
  TEST_IDENTITY,
  TEST_SANDBOX,
  createTestQueryClient,
  createWrapper,
  resetSandboxState,
  seedActiveSandbox,
} from "../helpers";

const mockRouter = { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock("@theone/client", () => ({ ...jest.requireActual("@theone/client"), TheOneClient: jest.fn() }));
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  get router() {
    return mockRouter;
  },
}));

const MockClient = TheOneClient as unknown as jest.Mock;
const fake = {
  identity: jest.fn(),
  status: jest.fn(),
  listProjects: jest.fn(),
  listProcesses: jest.fn(),
  listBuilds: jest.fn(),
  listAgentRuns: jest.fn(),
  claudeAuth: jest.fn(),
};

const renderScreen = () => renderHook(() => useProfileScreen(), { wrapper: createWrapper(createTestQueryClient()) });

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

describe("useProfileScreen", () => {
  it("builds the hero from the Tailscale identity and status counts", async () => {
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.profile?.name).toBe("Ada Lovelace"));
    await waitFor(() => expect(result.current.stats[0].value).toBe("2"));

    expect(result.current.profile).toMatchObject({ team: "example.com", photo: "https://example.com/ada.png" });
    expect(result.current.tailscaleMissing).toBe(false);
    expect(result.current.identityError).toBeNull();
    await act(async () => result.current.openHub());
    expect(mockRouter.navigate).toHaveBeenCalledWith("/agents");
  });

  it("summarises the Claude account and opens its screen", async () => {
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.claudeAccount).toBe("dev@example.com"));
    await act(async () => result.current.openClaudeAccount());
    expect(mockRouter.push).toHaveBeenCalledWith("/sandbox/claude");
  });

  it("shows why the Claude account can't be checked", async () => {
    fake.claudeAuth.mockRejectedValue(new ApiError(404, "not_found", "Not found"));
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.claudeAccount).toBe("Not found"));
  });

  it("lists activity that opens the matching screen", async () => {
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.activity).toHaveLength(3));
    expect(result.current.activityLoading).toBe(false);

    const byId = (id: string) => result.current.activity.find((item) => item.id === id);
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
    await waitFor(() => expect(result.current.activity).toHaveLength(3));
    await act(async () => result.current.activity.find((item) => item.id.startsWith("process-"))?.onPress?.());
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/sandbox/projects/[id]",
      params: { id: sampleProject.id, process: sampleProcess.id },
    });
  });

  it("falls back to the sandbox when Tailscale identity is unavailable", async () => {
    fake.identity.mockResolvedValue(NO_TAILSCALE);
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.tailscaleMissing).toBe(true));
    expect(result.current.profile?.name).toBe(TEST_SANDBOX.name);
  });

  it("treats a controller without the identity route as unavailable", async () => {
    fake.identity.mockRejectedValue(new ApiError(404, "not_found", "Not found"));
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.tailscaleMissing).toBe(true));
    expect(result.current.identityError).toBeNull();
  });

  it("reports other identity errors with a retry", async () => {
    fake.identity.mockRejectedValue(new NetworkError("offline"));
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.identityError).toMatch(/Can't reach the sandbox/));
    fake.identity.mockResolvedValue(TEST_IDENTITY);
    await act(async () => result.current.retryIdentity());
    await waitFor(() => expect(result.current.identityError).toBeNull());
  });

  it("reports a failed activity feed and retries it", async () => {
    fake.listBuilds.mockRejectedValue(new ApiError(500, "internal", "Boom"));
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.activityError).toBe("Boom"));

    fake.listBuilds.mockResolvedValue([sampleBuild]);
    await act(async () => result.current.retryActivity());
    await waitFor(() => expect(result.current.activityError).toBeNull());
    await waitFor(() => expect(result.current.activity.some((item) => item.id === `build-${sampleBuild.id}`)).toBe(true));
  });

  it("has nothing to show without a paired sandbox", async () => {
    resetSandboxState();
    const { result } = await renderScreen();
    expect(result.current.sandbox).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(result.current.activity).toEqual([]);
  });
});
