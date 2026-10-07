import type { SttProfile } from "@theone/protocol";

export const SECTION_LABELS = {
  title: "Speech-to-text",
  profilesGroup: "Resource usage",
  profilesDescription:
    "Voice notes are transcribed locally with whisper.cpp inside the sandbox. Pick how much of this computer it may use.",
  statusGroup: "Status",
  thread: "thread",
  nice: (value: number) => `nice ${value}`,
  modelMissing: "Model not installed in the sandbox",
  engine: "Engine",
  model: "Model",
  state: "State",
  activity: "Activity",
  cpus: "CPU cores",
  ready: "Ready",
  notReady: "Not ready",
  idle: "Idle",
  busy: "Transcribing",
  queued: (count: number) => `${count} queued`,
  geminiGroup: "Gemini",
  geminiDescription:
    "Cloud transcription for voice notes sent with the Gemini provider. The key is stored on the sandbox and shared with the mobile app.",
  geminiKey: "API key",
  geminiRemove: "Remove saved key",
  save: "Save",
  outdated:
    "This sandbox is too old for speech-to-text settings. Rebuild and restart it: `bun run sandbox build` then `bun run sandbox up`.",
} as const;

export const PROFILE_LABELS: Record<SttProfile, { title: string; description: string }> = {
  off: { title: "Off", description: "Voice notes are not transcribed" },
  eco: { title: "Eco", description: "Lowest impact: base model, 2 threads, idle CPU and disk priority" },
  balanced: { title: "Balanced", description: "Faster: base model, a quarter of the CPU cores, low CPU priority" },
  performance: { title: "Performance", description: "Most accurate: small model, half the CPU cores, normal priority" },
};

export const GEMINI_SOURCE_LABELS = {
  settings: "Saved from an app",
  none: "Not set",
} as const;

export const STT_TOASTS = {
  changed: (profile: string) => `Speech-to-text set to ${profile}`,
  changeFailed: (error: string) => `Couldn't change speech-to-text: ${error}`,
  geminiSaved: "Gemini API key saved",
  geminiRemoved: "Gemini API key removed",
  geminiFailed: (error: string) => `Couldn't update the Gemini API key: ${error}`,
} as const;
