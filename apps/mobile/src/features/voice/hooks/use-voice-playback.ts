import { useCallback, useMemo, useRef, useState } from "react";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import type { Upload } from "@theone/protocol";

import { useUploadSource } from "@/features/attachments/hooks/use-upload-source";
import { describeError } from "@/features/sandbox/utils/errors";

import { useLocalClip } from "../store/local-audio-store";
import { BUBBLE_LEVEL_COUNT, PLAYER_UPDATE_MS } from "../utils/constants";
import { formatDuration, resampleLevels, seededLevels } from "../utils/levels";

export type VoicePlayback = ReturnType<typeof useVoicePlayback>;

export function useVoicePlayback(upload: Pick<Upload, "id">) {
  const remote = useUploadSource(upload.id);
  const clip = useLocalClip(upload.id);
  const player = useAudioPlayer(null, { updateInterval: PLAYER_UPDATE_MS });
  const status = useAudioPlayerStatus(player);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const localUri = clip?.uri ?? null;

  const durationMs = status.duration > 0 ? status.duration * 1000 : (clip?.durationMs ?? null);
  const atEnd = status.duration > 0 && status.currentTime >= status.duration - PLAYER_UPDATE_MS / 1000;
  const progress = durationMs ? Math.min(1, (status.currentTime * 1000) / durationMs) : 0;

  const toggle = useCallback(async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    setError(null);
    try {
      if (!loadedRef.current) {
        setResolving(true);
        const source = localUri ? { uri: localUri } : remote;
        if (!source) throw new Error("No sandbox is paired.");
        player.replace(source);
        loadedRef.current = true;
      } else if (status.didJustFinish || atEnd) {
        await player.seekTo(0);
      }
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
      player.play();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setResolving(false);
    }
  }, [status.playing, status.didJustFinish, atEnd, player, localUri, remote]);

  const levels = useMemo(
    () => (clip ? resampleLevels(clip.levels, BUBBLE_LEVEL_COUNT) : seededLevels(upload.id, BUBBLE_LEVEL_COUNT)),
    [clip, upload.id],
  );

  const showsPosition = status.playing || (status.currentTime > 0 && !atEnd);

  return {
    playing: status.playing,
    loading: resolving || (status.playing && status.isBuffering),
    progress: atEnd && !status.playing ? 0 : progress,
    levels,
    durationLabel: showsPosition
      ? formatDuration(status.currentTime * 1000)
      : durationMs !== null
        ? formatDuration(durationMs)
        : null,
    error,
    toggle,
  };
}
