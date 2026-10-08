import { fireEvent, render, screen } from "@testing-library/react-native";
import { sampleClaudeAccountList, sampleClaudeAuthStatus } from "@tesseract/protocol/fixtures";

import ClaudeAccountScreen from "@/app/sandbox/claude";
import { claudeAccountRows } from "@/features/claude-account/utils/accounts";
import { claudeStatusView } from "@/features/claude-account/utils/status";

const mockScreen = jest.fn();
jest.mock("@/features/claude-account/hooks/use-claude-account-screen", () => ({
  useClaudeAccountScreen: () => mockScreen(),
}));

function state(overrides: object = {}) {
  return {
    back: jest.fn(),
    view: claudeStatusView(sampleClaudeAuthStatus),
    error: null,
    retry: jest.fn(),
    accounts: claudeAccountRows(sampleClaudeAccountList, null),
    accountsLoading: false,
    accountsError: null,
    accountsUnsupported: false,
    retryAccounts: jest.fn(),
    selectDefault: jest.fn(),
    defaultError: null,
    refreshing: false,
    refresh: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => mockScreen.mockReset());

describe("ClaudeAccountScreen", () => {
  it("lists the accounts, the primary sign-in and where credentials come from", async () => {
    mockScreen.mockReturnValue(state());
    await render(<ClaudeAccountScreen />);

    expect(screen.getByText("claude-work")).toBeOnTheScreen();
    expect(screen.getByText("Default")).toBeOnTheScreen();
    expect(screen.getByText("Signed in")).toBeOnTheScreen();
    expect(screen.getByText("OAuth token")).toBeOnTheScreen();
    expect(screen.getByText(/~\/\.claude-<name>/)).toBeOnTheScreen();
    expect(screen.getByText(/never changes the host's login/)).toBeOnTheScreen();
  });

  it("sets the default account on tap", async () => {
    const current = state();
    mockScreen.mockReturnValue(current);
    await render(<ClaudeAccountScreen />);

    await fireEvent.press(screen.getByTestId("claude-account-claude-work"));
    expect(current.selectDefault).toHaveBeenCalledWith("claude-work");
  });

  it("shows a switch error and an outdated sandbox", async () => {
    mockScreen.mockReturnValue(state({ defaultError: "boom" }));
    await render(<ClaudeAccountScreen />);
    expect(screen.getByText("boom")).toBeOnTheScreen();

    mockScreen.mockReturnValue(state({ accounts: null, accountsUnsupported: true }));
    await render(<ClaudeAccountScreen />);
    expect(screen.getByText(/Update the sandbox/)).toBeOnTheScreen();
  });

  it("retries a failed account list", async () => {
    const failed = state({ accounts: null, accountsError: "Can't reach the sandbox." });
    mockScreen.mockReturnValue(failed);
    await render(<ClaudeAccountScreen />);
    expect(screen.getByText("Couldn't load the Claude accounts")).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByText("Try again")[0]);
    expect(failed.retryAccounts).toHaveBeenCalled();
  });

  it("shows loading and error states", async () => {
    mockScreen.mockReturnValue(state({ view: null }));
    await render(<ClaudeAccountScreen />);
    expect(screen.getByText("Checking Claude sign-in…")).toBeOnTheScreen();

    const failed = state({ view: null, error: "Can't reach the sandbox." });
    mockScreen.mockReturnValue(failed);
    await render(<ClaudeAccountScreen />);
    expect(screen.getByText("Can't reach the sandbox.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Try again"));
    expect(failed.retry).toHaveBeenCalled();
  });
});
