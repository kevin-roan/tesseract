import { act, renderHook } from "@testing-library/react-native";
import { TesseractClient } from "@tesseract/client";

import { useVoicePlayback } from "@/features/voice/hooks/use-voice-playback";
import { useLocalAudioStore } from "@/features/voice/store/local-audio-store";

import { __reset as resetAudio, __setPlayerStatus, player } from "../../mocks/expo-audio";
import { createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../sandbox/helpers";

jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), TesseractClient: jest.fn() }));

const MockClient = TesseractClient as unknown as jest.Mock;
const fake = {
  httpUrl: (path: string) => `http://sandbox${path}`,
  authHeaders: () => ({ Authorization: "Bearer t" }),
};
const wrapper = () => createWrapper(createTestQueryClient());

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  resetAudio();
  useLocalAudioStore.setState({ clips: {} });
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useVoicePlayback", () => {
  it("plays a just-recorded clip from its local file", async () => {
    useLocalAudioStore.getState().remember("upl_local00001", { uri: "file:///rec.m4a", durationMs: 30_000, levels: [0.5] });
    const { result } = await renderHook(() => useVoicePlayback({ id: "upl_local00001" }), { wrapper: wrapper() });

    expect(result.current.durationLabel).toBe("0:30");
    await act(async () => result.current.toggle());
    expect(player.replace).toHaveBeenCalledWith({ uri: "file:///rec.m4a" });
    expect(player.play).toHaveBeenCalled();
  });

  it("streams an older clip from the sandbox and pauses while playing", async () => {
    const { result, rerender } = await renderHook(() => useVoicePlayback({ id: "upl_remote0001" }), { wrapper: wrapper() });

    expect(result.current.durationLabel).toBeNull();
    expect(result.current.levels.length).toBeGreaterThan(0);
    await act(async () => result.current.toggle());
    expect(player.replace).toHaveBeenCalledWith({
      uri: "http://sandbox/v1/uploads/upl_remote0001/content",
      headers: { Authorization: "Bearer t" },
    });

    __setPlayerStatus({ playing: true, currentTime: 5, duration: 20 });
    await rerender({});
    expect(result.current.progress).toBeCloseTo(0.25);
    expect(result.current.durationLabel).toBe("0:05");
    await act(async () => result.current.toggle());
    expect(player.pause).toHaveBeenCalled();
  });

  it("reports a failure to start playback", async () => {
    player.replace.mockImplementationOnce(() => {
      throw new Error("gone");
    });
    const { result } = await renderHook(() => useVoicePlayback({ id: "upl_remote0001" }), { wrapper: wrapper() });
    await act(async () => result.current.toggle());
    expect(result.current.error).toBe("gone");
    expect(player.play).not.toHaveBeenCalled();
  });
});
