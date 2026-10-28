import { fireEvent, render, screen } from "@testing-library/react-native";
import { sampleSttStatus } from "@tesseract/protocol/fixtures";

import VoiceScreen from "@/app/settings/voice";
import { sttProfileRows, sttProviderRows } from "@/features/settings/utils/stt";

const mockScreen = jest.fn();
jest.mock("@/features/settings/hooks/use-voice-screen", () => ({ useVoiceScreen: () => mockScreen() }));

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
      geminiKey: { value: "", onChange: jest.fn(), hint: "hint", save: jest.fn(), saving: false, remove: jest.fn(), removing: false },
      ...stt,
    },
    refreshing: false,
    refresh: jest.fn(),
  };
}

beforeEach(() => mockScreen.mockReset());

describe("VoiceScreen", () => {
  it("picks the engine, the native profile and the Gemini key", async () => {
    const value = state();
    mockScreen.mockReturnValue(value);
    await render(<VoiceScreen />);

    expect(screen.getByText("Gemini isn't set up")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("stt-provider-native"));
    expect(value.stt.selectProvider).toHaveBeenCalledWith("native");
    await fireEvent.press(screen.getByTestId("stt-profile-balanced"));
    expect(value.stt.selectProfile).toHaveBeenCalledWith("balanced");
    await fireEvent.changeText(screen.getByTestId("gemini-key-input"), "AIza");
    expect(value.stt.geminiKey.onChange).toHaveBeenCalledWith("AIza");
    await fireEvent.press(screen.getByTestId("gemini-key-remove"));
    expect(value.stt.geminiKey.remove).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Go back"));
    expect(value.back).toHaveBeenCalled();
  });

  it("offers a retry when the speech-to-text status can't load", async () => {
    const value = state({ profileRows: null, geminiMissing: false, error: "Sandbox unreachable" });
    mockScreen.mockReturnValue(value);
    await render(<VoiceScreen />);

    expect(screen.queryByText("Gemini isn't set up")).toBeNull();
    expect(screen.getByText("Sandbox unreachable")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Try again"));
    expect(value.stt.retry).toHaveBeenCalled();
  });
});
