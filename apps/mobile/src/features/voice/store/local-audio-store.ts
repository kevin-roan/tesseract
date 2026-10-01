import { create } from "zustand";

import type { RecordedClip } from "../types";

type LocalAudioState = {
  clips: Record<string, RecordedClip>;
  remember: (uploadId: string, clip: RecordedClip) => void;
};

export const useLocalAudioStore = create<LocalAudioState>((set) => ({
  clips: {},
  remember: (uploadId, clip) => set((state) => ({ clips: { ...state.clips, [uploadId]: clip } })),
}));

export const useLocalClip = (uploadId: string | null): RecordedClip | undefined =>
  useLocalAudioStore((state) => (uploadId ? state.clips[uploadId] : undefined));
