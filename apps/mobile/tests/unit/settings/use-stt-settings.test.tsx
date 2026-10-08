import { act, renderHook, waitFor } from "@testing-library/react-native";
import { TesseractClient } from "@tesseract/client";
import { sampleSttStatus } from "@tesseract/protocol/fixtures";

import { useSttSettings } from "@/features/settings/hooks/use-stt-settings";
import { useSettingsStore } from "@/features/settings/store/settings-store";

import { createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../sandbox/helpers";

jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), TesseractClient: jest.fn() }));
jest.mock("expo-router", () => ({ useIsFocused: () => true }));

const MockClient = TesseractClient as unknown as jest.Mock;
const fake = { stt: jest.fn(), updateStt: jest.fn() };

const renderSettings = () => renderHook(() => useSttSettings(), { wrapper: createWrapper(createTestQueryClient()) });

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  useSettingsStore.setState({ sttProvider: "gemini" });
  fake.stt.mockReset().mockResolvedValue(sampleSttStatus);
  fake.updateStt.mockReset().mockResolvedValue({ ...sampleSttStatus, profile: "performance" });
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useSttSettings", () => {
  it("switches the provider on the device", async () => {
    const { result } = await renderSettings();
    await waitFor(() => expect(result.current.profileRows).not.toBeNull());
    expect(result.current.geminiMissing).toBe(true);

    await act(async () => result.current.selectProvider("native"));
    expect(useSettingsStore.getState().sttProvider).toBe("native");
    expect(result.current.providerRows[1].selected).toBe(true);
    expect(result.current.geminiMissing).toBe(false);

    await act(async () => result.current.selectProvider("bogus"));
    expect(useSettingsStore.getState().sttProvider).toBe("native");
  });

  it("changes the native profile on the sandbox", async () => {
    const { result } = await renderSettings();
    await waitFor(() => expect(result.current.profileRows).not.toBeNull());

    await act(async () => result.current.selectProfile("eco"));
    expect(fake.updateStt).not.toHaveBeenCalled();

    await act(async () => result.current.selectProfile("performance"));
    await waitFor(() => expect(result.current.profileRows?.find((row) => row.selected)?.id).toBe("performance"));
    expect(fake.updateStt).toHaveBeenCalledWith({ profile: "performance" });
  });

  it("saves and removes the Gemini key on the sandbox", async () => {
    const saved = { ...sampleSttStatus, gemini: { ...sampleSttStatus.gemini, configured: true, source: "settings" as const } };
    fake.updateStt.mockResolvedValueOnce(saved).mockResolvedValueOnce(sampleSttStatus);
    const { result } = await renderSettings();
    await waitFor(() => expect(result.current.geminiKey).not.toBeNull());
    expect(result.current.geminiKey?.remove).toBeUndefined();

    await act(async () => result.current.geminiKey?.save());
    expect(fake.updateStt).not.toHaveBeenCalled();

    await act(async () => result.current.geminiKey?.onChange("  AIza-new  "));
    await act(async () => result.current.geminiKey?.save());
    await waitFor(() => expect(result.current.geminiMissing).toBe(false));
    expect(fake.updateStt).toHaveBeenCalledWith({ geminiApiKey: "AIza-new" });
    expect(result.current.geminiKey?.value).toBe("");
    expect(result.current.geminiKey?.hint).toContain("A key is saved");

    await act(async () => result.current.geminiKey?.remove?.());
    await waitFor(() => expect(result.current.geminiKey?.remove).toBeUndefined());
    expect(fake.updateStt).toHaveBeenLastCalledWith({ geminiApiKey: null });
  });

  it("reports a failed status load", async () => {
    fake.stt.mockRejectedValue(new Error("Sandbox unreachable"));
    const { result } = await renderSettings();
    await waitFor(() => expect(result.current.error).toBe("Sandbox unreachable"));
    expect(result.current.profileRows).toBeNull();
  });
});
