import type { DefineContract } from "../ipc-types";

export type MicrophoneAccess = "granted" | "denied" | "restricted" | "not-determined" | "unknown";

export type SttContract = DefineContract<{
  methods: {
    microphone(): MicrophoneAccess;
    requestMicrophone(): MicrophoneAccess;
  };
  events: Record<never, never>;
}>;
