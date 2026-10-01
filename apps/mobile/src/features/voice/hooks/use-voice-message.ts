import { useCallback, useState } from "react";
import type { Upload } from "@theone/protocol";

import { useUploadFile } from "@/features/attachments/hooks/use-upload-file";
import { useTranscribe } from "@/features/sandbox/hooks/use-sandbox-mutations";
import { describeError } from "@/features/sandbox/utils/errors";

import { useLocalAudioStore } from "../store/local-audio-store";
import type { RecordedClip, VoicePhase } from "../types";
import { DEFAULT_VOICE_MIME_TYPE, LIVE_LEVEL_COUNT, VOICE_FILE_PREFIX, VOICE_MIME_TYPES } from "../utils/constants";
import { formatDuration, padLevels, resampleLevels, voiceFileName, voiceMimeType } from "../utils/levels";
import { useVoiceRecorder } from "./use-voice-recorder";

export type VoiceNote = { prompt: string; audio: Upload };

type Pending = { clip: RecordedClip; audio: Upload | null; transcript: string | null };

type VoiceMessageOptions = {
  onReady: (note: VoiceNote) => Promise<unknown>;
};

export type VoiceMessageState = ReturnType<typeof useVoiceMessage>;

export function useVoiceMessage({ onReady }: VoiceMessageOptions) {
  const upload = useUploadFile();
  const { mutateAsync: transcribe } = useTranscribe();
  const remember = useLocalAudioStore((state) => state.remember);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const process = useCallback(
    async (next: Pending) => {
      setPending(next);
      setBusy(true);
      setError(null);
      try {
        const audio =
          next.audio ??
          (await upload({
            uri: next.clip.uri,
            name: voiceFileName(next.clip.uri, VOICE_FILE_PREFIX),
            mimeType: voiceMimeType(next.clip.uri, VOICE_MIME_TYPES, DEFAULT_VOICE_MIME_TYPE),
            sizeBytes: null,
          }));
        remember(audio.id, next.clip);
        setPending({ ...next, audio });
        const transcript = next.transcript ?? (await transcribe({ uploadId: audio.id })).text.trim();
        if (!transcript) throw new Error("No speech was recognised in this recording.");
        setPending({ clip: next.clip, audio, transcript });
        await onReady({ prompt: transcript, audio });
        setPending(null);
      } catch (cause) {
        setError(describeError(cause));
      } finally {
        setBusy(false);
      }
    },
    [upload, transcribe, remember, onReady],
  );

  const onFinished = useCallback(
    (clip: RecordedClip) => void process({ clip, audio: null, transcript: null }),
    [process],
  );
  const recorder = useVoiceRecorder({ onFinished });

  const retry = useCallback(() => {
    if (pending && !busy) void process(pending);
  }, [pending, busy, process]);

  const discard = useCallback(() => {
    setPending(null);
    setError(null);
  }, []);

  const phase: VoicePhase = recorder.recording ? "recording" : busy ? "transcribing" : pending ? "failed" : "idle";
  const durationMs = recorder.recording ? recorder.elapsedMs : (pending?.clip.durationMs ?? 0);

  return {
    phase,
    active: phase !== "idle",
    levels: recorder.recording
      ? padLevels(recorder.levels, LIVE_LEVEL_COUNT)
      : resampleLevels(pending?.clip.levels ?? [], LIVE_LEVEL_COUNT),
    elapsedLabel: formatDuration(durationMs),
    error: error ?? recorder.error,
    start: recorder.start,
    stop: recorder.finish,
    cancel: recorder.cancel,
    retry,
    discard,
    clearError: recorder.clearError,
  };
}
