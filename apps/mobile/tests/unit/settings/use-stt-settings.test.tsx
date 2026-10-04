import { act, renderHook, waitFor } from "@testing-library/react-native";
import { TheOneClient } from "@theone/client";
import { sampleSttStatus } from "@theone/protocol/fixtures";

import { useSttSettings } from "@/features/settings/hooks/use-stt-settings";
import { useSettingsStore } from "@/features/settings/store/settings-store";

import { createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../sandbox/helpers";

jest.mock("@theone/client", () => ({ ...jest.requireActual("@theone/client"), TheOneClient: jest.fn() }));
jest.mock("expo-router", () => ({ useIsFocused: () => true }));

const MockClient = TheOneClient as unknown as jest.Mock;
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

  it("reports a failed status load", async () => {
    fake.stt.mockRejectedValue(new Error("Sandbox unreachable"));
    const { result } = await renderSettings();
    await waitFor(() => expect(result.current.error).toBe("Sandbox unreachable"));
    expect(result.current.profileRows).toBeNull();
  });
});
