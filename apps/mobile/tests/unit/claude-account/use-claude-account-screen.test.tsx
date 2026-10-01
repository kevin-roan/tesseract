import { renderHook, waitFor } from "@testing-library/react-native";
import { ApiError, TheOneClient } from "@theone/client";
import type { ClaudeAuthStatus } from "@theone/protocol";
import { sampleClaudeAuthStatus } from "@theone/protocol/fixtures";

import { useClaudeAccountScreen } from "@/features/claude-account/hooks/use-claude-account-screen";

import {
  createTestQueryClient,
  createWrapper,
  resetSandboxState,
  seedActiveSandbox,
} from "../sandbox/helpers";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock("@theone/client", () => ({ ...jest.requireActual("@theone/client"), TheOneClient: jest.fn() }));
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  get router() {
    return mockRouter;
  },
}));

const signedOut: ClaudeAuthStatus = {
  ...sampleClaudeAuthStatus,
  method: "none",
  loggedIn: false,
  sources: { oauthToken: false, credentials: false, apiKey: false },
  account: null,
};

const MockClient = TheOneClient as unknown as jest.Mock;
const fake = { claudeAuth: jest.fn() };

const renderScreen = () =>
  renderHook(() => useClaudeAccountScreen(), { wrapper: createWrapper(createTestQueryClient()) });

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  fake.claudeAuth.mockReset().mockResolvedValue(signedOut);
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useClaudeAccountScreen", () => {
  it("loads the status view", async () => {
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.view?.title).toBe("Not signed in"));
    expect(result.current.error).toBeNull();
  });

  it("shows a signed-in account", async () => {
    fake.claudeAuth.mockResolvedValue(sampleClaudeAuthStatus);
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.view?.badge.label).toBe("Signed in"));
  });

  it("reports a failed status check and retries", async () => {
    fake.claudeAuth.mockRejectedValue(new ApiError(500, "internal", "boom"));
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.error).toBe("boom"));
    expect(result.current.view).toBeNull();

    fake.claudeAuth.mockResolvedValue(sampleClaudeAuthStatus);
    result.current.retry();
    await waitFor(() => expect(result.current.view?.badge.label).toBe("Signed in"));
  });
});
