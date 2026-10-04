import { fireEvent, render, screen } from "@testing-library/react-native";
import { sampleSttStatus } from "@theone/protocol/fixtures";

import SettingsScreen from "@/app/settings";
import { INPUT_MODE_OPTIONS, ISLAND_PLACEMENT_OPTIONS, LIVE_ACTIVITY_OPTIONS } from "@/features/settings/utils/constants";
import { sttProfileRows, sttProviderRows } from "@/features/settings/utils/stt";

const mockScreen = jest.fn();
jest.mock("@/features/settings/hooks/use-settings-screen", () => ({ useSettingsScreen: () => mockScreen() }));

function state(stt: object = {}) {
  return {
    back: jest.fn(),
    stt: {
      providerRows: sttProviderRows("gemini", sampleSttStatus),
      selectProvider: jest.fn(),
      geminiMissing: true,
      profileRows: sttProfileRows(sampleSttStatus, null),
      selectProfile: jest.fn(),
      loading: false,
      engineIssue: null,
      error: null,
      retry: jest.fn(),
      updateError: null,
      ...stt,
    },
    hub: { title: "Sandbox hub", subtitle: "devbox", open: jest.fn() },
    claude: { title: "Claude accounts", subtitle: "dev@example.com", open: jest.fn() },
    host: { title: "Host shell", subtitle: "Not paired", open: jest.fn() },
    inputMode: { options: INPUT_MODE_OPTIONS, selectedId: "trackpad", select: jest.fn() },
    islandPlacement: { options: ISLAND_PLACEMENT_OPTIONS, selectedId: "bottomRight", select: jest.fn() },
    liveActivity: { options: LIVE_ACTIVITY_OPTIONS, selectedId: "on", select: jest.fn() },
    refreshing: false,
    refresh: jest.fn(),
  };
}

beforeEach(() => mockScreen.mockReset());

describe("SettingsScreen", () => {
  it("lists speech to text, sandbox and display settings", async () => {
    const value = state();
    mockScreen.mockReturnValue(value);
    await render(<SettingsScreen />);

    expect(screen.getByText("Gemini isn't set up")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("stt-provider-native"));
    expect(value.stt.selectProvider).toHaveBeenCalledWith("native");
    await fireEvent.press(screen.getByTestId("stt-profile-balanced"));
    expect(value.stt.selectProfile).toHaveBeenCalledWith("balanced");

    await fireEvent.press(screen.getByText("Sandbox hub"));
    expect(value.hub.open).toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Claude accounts"));
    expect(value.claude.open).toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Host shell"));
    expect(value.host.open).toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Touch"));
    expect(value.inputMode.select).toHaveBeenCalledWith("touch");
    await fireEvent.press(screen.getByText("Top left"));
    expect(value.islandPlacement.select).toHaveBeenCalledWith("topLeft");
    await fireEvent.press(screen.getAllByText("Off").at(-1)!);
    expect(value.liveActivity.select).toHaveBeenCalledWith("off");
  });

  it("offers a retry when the speech-to-text status can't load", async () => {
    const value = state({ profileRows: null, geminiMissing: false, error: "Sandbox unreachable" });
    mockScreen.mockReturnValue(value);
    await render(<SettingsScreen />);

    expect(screen.queryByText("Gemini isn't set up")).toBeNull();
    expect(screen.getByText("Sandbox unreachable")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Try again"));
    expect(value.stt.retry).toHaveBeenCalled();
  });
});
