import { fireEvent, render, screen } from "@testing-library/react-native";

import UpdatePrompt from "@/features/settings/components/update-prompt";
import { showsUpdatePrompt } from "@/features/settings/utils/about";
import { UPDATE_SHEET_COPY } from "@/features/settings/utils/constants";

const mockUpdates = jest.fn();
let mockPathname = "/";
jest.mock("@/features/settings/hooks/use-app-updates", () => ({ useAppUpdates: () => mockUpdates() }));
jest.mock("expo-router", () => ({ usePathname: () => mockPathname }));

function updates(overrides: object = {}) {
  return {
    available: true,
    nextUpdate: { id: "u-2", createdAt: new Date(0) },
    installing: false,
    installError: null,
    install: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockUpdates.mockReset();
  mockPathname = "/";
});

describe("showsUpdatePrompt", () => {
  it("stays off onboarding and pairing screens", () => {
    expect(showsUpdatePrompt("/")).toBe(true);
    expect(showsUpdatePrompt("/settings")).toBe(true);
    expect(showsUpdatePrompt("/welcome")).toBe(false);
    expect(showsUpdatePrompt("/setup")).toBe(false);
    expect(showsUpdatePrompt("/pair")).toBe(false);
    expect(showsUpdatePrompt("/host/terminal/1")).toBe(false);
  });
});

describe("UpdatePrompt", () => {
  it("offers to install an available update", async () => {
    const value = updates();
    mockUpdates.mockReturnValue(value);
    await render(<UpdatePrompt />);

    expect(screen.getByText(UPDATE_SHEET_COPY.title)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("update-sheet-install"));
    expect(value.install).toHaveBeenCalled();
  });

  it("hides after Later until another update arrives", async () => {
    mockUpdates.mockReturnValue(updates());
    await render(<UpdatePrompt />);
    await fireEvent.press(screen.getByTestId("update-sheet-later"));
    expect(screen.queryByText(UPDATE_SHEET_COPY.title)).toBeNull();

    mockUpdates.mockReturnValue(updates({ nextUpdate: { id: "u-3", createdAt: new Date(0) } }));
    await screen.rerender(<UpdatePrompt />);
    expect(screen.getByText(UPDATE_SHEET_COPY.title)).toBeOnTheScreen();
  });

  it("stays hidden without an update or on onboarding", async () => {
    mockUpdates.mockReturnValue(updates({ available: false }));
    await render(<UpdatePrompt />);
    expect(screen.queryByText(UPDATE_SHEET_COPY.title)).toBeNull();

    mockPathname = "/welcome";
    mockUpdates.mockReturnValue(updates());
    await render(<UpdatePrompt />);
    expect(screen.queryByText(UPDATE_SHEET_COPY.title)).toBeNull();
  });

  it("shows install errors", async () => {
    mockUpdates.mockReturnValue(updates({ installError: "Network down" }));
    await render(<UpdatePrompt />);
    expect(screen.getByText("Network down")).toBeOnTheScreen();
  });
});
