import { fireEvent, render, screen } from "@testing-library/react-native";
import { sampleClaudeAuthStatus } from "@theone/protocol/fixtures";

import ClaudeAccountScreen from "@/app/sandbox/claude";
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
    refreshing: false,
    refresh: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => mockScreen.mockReset());

describe("ClaudeAccountScreen", () => {
  it("shows the read-only status and where credentials come from", async () => {
    mockScreen.mockReturnValue(state());
    await render(<ClaudeAccountScreen />);

    expect(screen.getByText("Signed in")).toBeOnTheScreen();
    expect(screen.getByText("OAuth token")).toBeOnTheScreen();
    expect(screen.getByText(/host machine's ~\/\.claude folder/)).toBeOnTheScreen();
    expect(screen.queryByText(/setup-token/)).toBeNull();
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
