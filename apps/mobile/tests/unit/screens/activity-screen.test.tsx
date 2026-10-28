import { fireEvent, render, screen } from "@testing-library/react-native";

import ActivityScreen from "@/app/sandbox/activity";

const mockActivity = jest.fn();
jest.mock("@/features/sandbox/hooks/use-activity-screen", () => ({ useActivityScreen: () => mockActivity() }));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

const item = {
  id: "build-bld_1",
  actor: "Ada Lovelace",
  action: "built Windows installer for",
  target: "electron-hello",
  timeAgo: "5m ago",
  metrics: [{ id: "state", value: "Succeeded", label: "State" }],
  testID: "activity-build-bld_1",
  onPress: jest.fn(),
};

function state(overrides: object = {}) {
  return {
    back: jest.fn(),
    items: [],
    loading: false,
    error: null,
    retry: jest.fn(),
    askClaude: jest.fn(),
    refreshing: false,
    refresh: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => mockActivity.mockReset());

describe("ActivityScreen", () => {
  it("lists the feed and opens an item", async () => {
    const value = state({ items: [item] });
    mockActivity.mockReturnValue(value);
    await render(<ActivityScreen />);

    await fireEvent.press(screen.getByTestId("activity-build-bld_1"));
    expect(item.onPress).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Go back"));
    expect(value.back).toHaveBeenCalled();
  });

  it("offers a first Claude run on an empty feed", async () => {
    const value = state();
    mockActivity.mockReturnValue(value);
    await render(<ActivityScreen />);

    expect(screen.getByText("No activity yet")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Ask Claude"));
    expect(value.askClaude).toHaveBeenCalled();
  });

  it("shows a spinner while the activity loads", async () => {
    mockActivity.mockReturnValue(state({ loading: true }));
    await render(<ActivityScreen />);
    expect(screen.getByLabelText("Loading activity…")).toBeOnTheScreen();
  });

  it("shows a failed feed with a retry instead of an empty feed", async () => {
    const value = state({ error: "Can't reach the sandbox." });
    mockActivity.mockReturnValue(value);
    await render(<ActivityScreen />);

    expect(screen.queryByText("No activity yet")).toBeNull();
    expect(screen.getByText("Can't reach the sandbox.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Retry"));
    expect(value.retry).toHaveBeenCalled();
  });
});
