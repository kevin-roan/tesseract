import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from "expo-audio";

import { describeError } from "@/features/sandbox/utils/errors";
import { playHaptic } from "@/lib/haptics";

import type { RecordedClip } from "../types";
import { LIVE_LEVEL_COUNT, MAX_RECORDING_MS, MIN_RECORDING_MS, RECORDER_POLL_MS, RECORDING_OPTIONS } from "../utils/constants";
import { normalizeMetering, pushLevel } from "../utils/levels";

type VoiceRecorderOptions = {
  onFinished: (clip: RecordedClip) => void;
};

export function useVoiceRecorder({ onFinished }: VoiceRecorderOptions) {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const historyRef = useRef<number[]>([]);
  const stoppingRef = useRef(false);

  const halt = useCallback(async (): Promise<RecordedClip | null> => {
    if (stoppingRef.current) return null;
    stoppingRef.current = true;
    try {
      const { durationMillis } = recorder.getStatus();
      await recorder.stop();
      setRecording(false);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
      const uri = recorder.uri;
      return uri ? { uri, durationMs: durationMillis, levels: historyRef.current } : null;
    } finally {
      stoppingRef.current = false;
    }
  }, [recorder]);

  const finish = useCallback(async () => {
    try {
      const clip = await halt();
      if (clip && clip.durationMs >= MIN_RECORDING_MS) {
        playHaptic("recordStop");
        onFinished(clip);
      }
    } catch (cause) {
      setRecording(false);
      setError(describeError(cause));
    }
  }, [halt, onFinished]);

  const cancel = useCallback(async () => {
    await halt().catch(() => setRecording(false));
  }, [halt]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError("Allow microphone access in Settings to send voice messages.");
        return false;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      historyRef.current = [];
      setLevels([]);
      setElapsedMs(0);
      setRecording(true);
      return true;
    } catch (cause) {
      setError(describeError(cause));
      return false;
    }
  }, [recorder]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      const status = recorder.getStatus();
      historyRef.current.push(normalizeMetering(status.metering));
      setElapsedMs(status.durationMillis);
      setLevels((current) => pushLevel(current, normalizeMetering(status.metering), LIVE_LEVEL_COUNT));
      if (status.durationMillis >= MAX_RECORDING_MS) void finish();
    }, RECORDER_POLL_MS);
    return () => clearInterval(timer);
  }, [recording, recorder, finish]);

  const recordingRef = useRef(false);
  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);
  // A layout-effect cleanup runs before expo-audio's passive one releases the recorder, so a
  // recording cut short by leaving the screen is stopped instead of released while still live.
  useLayoutEffect(
    () => () => {
      if (!recordingRef.current) return;
      try {
        void recorder.stop().catch(() => undefined);
      } catch {}
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    },
    [recorder],
  );

  const clearError = useCallback(() => setError(null), []);

  return { recording, elapsedMs, levels, error, start, finish, cancel, clearError };
}
