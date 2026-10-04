import { RecordingPresets, type RecordingOptions } from "expo-audio";

export const MIN_RECORDING_MS = 500;
export const MAX_RECORDING_MS = 5 * 60_000;
export const RECORDER_POLL_MS = 80;
export const METER_FLOOR_DB = -60;
export const MIN_LEVEL = 0.06;
export const LIVE_LEVEL_COUNT = 40;
export const BUBBLE_LEVEL_COUNT = 32;
export const VOICE_MIME_TYPES: Record<string, string> = { m4a: "audio/mp4", mp4: "audio/mp4", webm: "audio/webm", "3gp": "audio/3gpp", caf: "audio/x-caf", wav: "audio/wav" };
export const DEFAULT_VOICE_MIME_TYPE = "audio/mp4";
export const VOICE_FILE_PREFIX = "voice-message";
export const RECORDING_OPTIONS: RecordingOptions = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };
export const PLAYER_UPDATE_MS = 100;
export const GEMINI_FALLBACK_PREFIX = "Gemini unavailable — used native transcription";
