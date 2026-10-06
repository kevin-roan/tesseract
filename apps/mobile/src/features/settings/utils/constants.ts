import { Platform } from "react-native";
import type { InputMode, SttProfile, SttProvider } from "@theone/protocol";
import {
  ArrowDownLeftIcon,
  ArrowDownRightIcon,
  ArrowUpLeftIcon,
  ArrowUpRightIcon,
  BellRingingIcon,
  BellSlashIcon,
  CloudIcon,
  CpuIcon,
  CursorClickIcon,
  EyeSlashIcon,
  DeviceMobileIcon,
  HandPointingIcon,
  MoonIcon,
  SunIcon,
  type Icon,
} from "phosphor-react-native";

import type { ChoiceOption } from "@/components/choice-group";
import type { IslandPlacement } from "@/features/island/types";

import type { AppearancePreference } from "../types";

export const SETTINGS_STORE_NAME = "theone.settings";
export const SETTINGS_STORE_VERSION = 1;
export const DEFAULT_STT_PROVIDER: SttProvider = "gemini";
export const DEFAULT_APPEARANCE: AppearancePreference = "dark";
export const APPEARANCE_PREFERENCES = ["system", "light", "dark"] as const satisfies readonly AppearancePreference[];

export const STT_PROVIDER_ICONS: Record<SttProvider, Icon> = { gemini: CloudIcon, native: CpuIcon };

export const STT_PROFILE_LABELS: Record<SttProfile, string> = {
  off: "Off",
  eco: "Eco",
  balanced: "Balanced",
  performance: "Performance",
};

export const APPEARANCE_OPTIONS: ChoiceOption[] = [
  { id: "system", label: "System", icon: DeviceMobileIcon },
  { id: "light", label: "Light", icon: SunIcon },
  { id: "dark", label: "Dark", icon: MoonIcon },
] satisfies (ChoiceOption & { id: AppearancePreference })[];

export const INPUT_MODE_OPTIONS: ChoiceOption[] = [
  { id: "trackpad", label: "Trackpad", icon: CursorClickIcon },
  { id: "touch", label: "Touch", icon: HandPointingIcon },
] satisfies (ChoiceOption & { id: InputMode })[];

const SYSTEM_ACTIVITY = Platform.OS === "ios" ? "Dynamic Island" : "notification";

export const ISLAND_PLACEMENT_OPTIONS: ChoiceOption[] = [
  { id: "topLeft", label: "Top left", icon: ArrowUpLeftIcon },
  { id: "topRight", label: "Top right", icon: ArrowUpRightIcon },
  { id: "bottomLeft", label: "Bottom left", icon: ArrowDownLeftIcon },
  { id: "bottomRight", label: "Bottom right", icon: ArrowDownRightIcon },
  { id: "hidden", label: `${Platform.OS === "ios" ? "Dynamic Island" : "Notification"} only`, icon: EyeSlashIcon },
] satisfies (ChoiceOption & { id: IslandPlacement })[];

export const LIVE_ACTIVITY_OPTIONS: ChoiceOption[] = [
  { id: "on", label: "On", icon: BellRingingIcon },
  { id: "off", label: "Off", icon: BellSlashIcon },
];

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
  geminiMissing: "Add a Gemini API key below, otherwise voice messages use Native transcription.",
  geminiKeyLabel: "Gemini API key",
  geminiKeyPlaceholder: "AIza…",
  geminiKeyHint: {
    settings: "A key is saved on the sandbox. Paste a new one to replace it.",
    env: "Using GEMINI_API_KEY from the sandbox. A key saved here takes priority.",
    none: "Stored on the sandbox and shared with the desktop app. Get one at aistudio.google.com.",
  },
  geminiKeySave: "Save key",
  geminiKeyRemove: "Remove",
  profileTitle: "Native engine",
  profileFootnote: "How much of the sandbox CPU whisper.cpp may use.",
  profileOff: "Native transcription is turned off",
  profileDetail: (model: string, threads: number) => `${model} model · ${threads} ${threads === 1 ? "thread" : "threads"}`,
  profileMissing: "Not installed",
  saving: "Saving…",
  sttFailed: "Couldn't load the speech-to-text settings",
  retry: "Try again",
  appearanceTitle: "Appearance",
  appearanceLabel: "Theme",
  appearanceFootnote: "System follows the light or dark setting of this device.",
  sandboxTitle: "Sandbox",
  hubTitle: "Sandbox hub",
  hubSubtitle: "Projects, runs and builds",
  displayTitle: "Remote display",
  inputModeLabel: "Input mode",
  inputModeFootnote: "How touches drive the sandbox desktop.",
  islandTitle: "Live work indicator",
  islandPlacementLabel: "In-app position",
  islandPlacementFootnote: "Where the running-work orb starts in the app. Drag it anywhere and it docks to the nearest edge.",
  liveActivityLabel: Platform.OS === "ios" ? "Live Activity" : "Ongoing notification",
  liveActivityFootnote: `Shows runs and commands in the ${SYSTEM_ACTIVITY} and on the lock screen.`,
} as const;
