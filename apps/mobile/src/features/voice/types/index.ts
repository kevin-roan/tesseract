export type RecordedClip = {
  uri: string;
  durationMs: number;
  levels: number[];
};

export type VoicePhase = "idle" | "recording" | "transcribing" | "failed";
