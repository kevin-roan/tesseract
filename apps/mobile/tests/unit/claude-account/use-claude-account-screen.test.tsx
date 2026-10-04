import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ApiError, TheOneClient } from "@theone/client";
import type { ClaudeAuthStatus } from "@theone/protocol";
import { sampleClaudeAccountList, sampleClaudeAuthStatus, sampleProject } from "@theone/protocol/fixtures";

import { useClaudeAccountScreen } from "@/features/claude-account/hooks/use-claude-account-screen";
import { useProjectClaudeAccount } from "@/features/claude-account/hooks/use-project-claude-account";

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
const fake = {
  claudeAuth: jest.fn(),
  claudeAccounts: jest.fn(),
  setDefaultClaudeAccount: jest.fn(),
  setProjectClaudeAccount: jest.fn(),
};

const renderScreen = () =>
  renderHook(() => useClaudeAccountScreen(), { wrapper: createWrapper(createTestQueryClient()) });

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  fake.claudeAuth.mockReset().mockResolvedValue(signedOut);
  fake.claudeAccounts.mockReset().mockResolvedValue(sampleClaudeAccountList);
  fake.setDefaultClaudeAccount.mockReset();
  fake.setProjectClaudeAccount.mockReset();
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

  it("lists the accounts and switches the default", async () => {
    fake.setDefaultClaudeAccount.mockResolvedValue({ ...sampleClaudeAccountList, defaultAccountId: "claude-work" });
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.accounts?.find((row) => row.selected)?.id).toBe("claude"));

    await act(async () => result.current.selectDefault("claude-work"));
    expect(fake.setDefaultClaudeAccount).toHaveBeenCalledWith({ accountId: "claude-work" });
    await waitFor(() => expect(result.current.accounts?.find((row) => row.selected)?.id).toBe("claude-work"));
  });

  it("reports a failed switch", async () => {
    fake.setDefaultClaudeAccount.mockRejectedValue(new ApiError(400, "bad_request", "Unknown account"));
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.accounts).not.toBeNull());

    await act(async () => result.current.selectDefault("claude-work"));
    await waitFor(() => expect(result.current.defaultError).toBe("Unknown account"));
    expect(result.current.accounts?.find((row) => row.selected)?.id).toBe("claude");
  });

  it("treats a missing accounts route as an outdated sandbox", async () => {
    fake.claudeAccounts.mockRejectedValue(new ApiError(404, "not_found", "No route"));
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.accountsUnsupported).toBe(true));
    expect(result.current.accountsError).toBeNull();
    expect(result.current.accounts).toBeNull();
  });
});

describe("useProjectClaudeAccount", () => {
  const renderProject = () =>
    renderHook(() => useProjectClaudeAccount(sampleProject), { wrapper: createWrapper(createTestQueryClient()) });

  it("follows the default and picks an account for the project", async () => {
    fake.setProjectClaudeAccount.mockResolvedValue({ ...sampleProject, claudeAccountId: "claude-work" });
    const { result } = await renderProject();
    await waitFor(() => expect(result.current.canChoose).toBe(true));
    expect(result.current.selectedId).toBe("default");
    expect(result.current.summary).toMatch(/^Default \(claude\)/);

    await act(async () => result.current.open());
    expect(result.current.sheetOpen).toBe(true);
    await act(async () => result.current.select("claude-work"));
    expect(result.current.sheetOpen).toBe(false);
    expect(fake.setProjectClaudeAccount).toHaveBeenCalledWith(sampleProject.id, { accountId: "claude-work" });
  });

  it("sends null for the default choice", async () => {
    fake.setProjectClaudeAccount.mockResolvedValue(sampleProject);
    const { result } = await renderHook(
      () => useProjectClaudeAccount({ ...sampleProject, claudeAccountId: "claude-work" }),
      { wrapper: createWrapper(createTestQueryClient()) },
    );
    await waitFor(() => expect(result.current.canChoose).toBe(true));
    expect(result.current.selectedId).toBe("claude-work");
    await act(async () => result.current.select("default"));
    expect(fake.setProjectClaudeAccount).toHaveBeenCalledWith(sampleProject.id, { accountId: null });
  });

  it("hides itself on an outdated sandbox", async () => {
    fake.claudeAccounts.mockRejectedValue(new ApiError(404, "not_found", "No route"));
    const { result } = await renderProject();
    await waitFor(() => expect(result.current.visible).toBe(false));
  });
});
