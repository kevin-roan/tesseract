import type { InputMode, SttProfile, SttProvider } from "@theone/protocol";
import {
  CloudIcon,
  CpuIcon,
  CursorClickIcon,
  HandPointingIcon,
  type Icon,
} from "phosphor-react-native";

import type { ChoiceOption } from "@/components/choice-group";

export const SETTINGS_STORE_NAME = "theone.settings";
export const SETTINGS_STORE_VERSION = 1;
export const DEFAULT_STT_PROVIDER: SttProvider = "gemini";

export const STT_PROVIDER_ICONS: Record<SttProvider, Icon> = { gemini: CloudIcon, native: CpuIcon };

export const STT_PROFILE_LABELS: Record<SttProfile, string> = {
  off: "Off",
  eco: "Eco",
  balanced: "Balanced",
  performance: "Performance",
};

export const INPUT_MODE_OPTIONS: ChoiceOption[] = [
  { id: "trackpad", label: "Trackpad", icon: CursorClickIcon },
  { id: "touch", label: "Touch", icon: HandPointingIcon },
] satisfies (ChoiceOption & { id: InputMode })[];

export const SETTINGS_COPY = {
  title: "Settings",
  subtitle: "Preferences for this device and sandbox",
  sttTitle: "Speech to text",
  providerFootnote: "Saved on this device. Every voice message you record uses this engine.",
  geminiLabel: "Gemini",
  geminiDetail: (model: string) =>
    `Cloud transcription via ${model}. Falls back to the sandbox's whisper.cpp if the key is missing, expired or out of quota.`,
  geminiNoKey: "No key",
  nativeLabel: "Native",
  nativeDetail: "whisper.cpp on the sandbox. Private, runs on the sandbox CPU.",
  geminiMissingTitle: "Gemini isn't set up",
  geminiMissing: "GEMINI_API_KEY isn't set on the sandbox, so voice messages use Native transcription.",
  profileTitle: "Native engine",
  profileFootnote: "How much of the sandbox CPU whisper.cpp may use.",
  profileOff: "Native transcription is turned off",
  profileDetail: (model: string, threads: number) => `${model} model · ${threads} ${threads === 1 ? "thread" : "threads"}`,
  profileMissing: "Not installed",
  saving: "Saving…",
  sttFailed: "Couldn't load the speech-to-text settings",
  retry: "Try again",
  sandboxTitle: "Sandbox",
  hubTitle: "Sandbox hub",
  hubSubtitle: "Projects, runs and builds",
  displayTitle: "Remote display",
  inputModeLabel: "Input mode",
  inputModeFootnote: "How touches drive the sandbox desktop.",
} as const;
