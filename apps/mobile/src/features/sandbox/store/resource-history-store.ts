import type { SandboxStatus } from "@tesseract/protocol";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { RESOURCE_HISTORY_STORE_NAME, RESOURCE_HISTORY_STORE_VERSION } from "../utils/constants";
import { appendSample, mergeSamples, sampleFromStatus, trimSandboxes, type MetricSample } from "../utils/metrics";
import { listStorage } from "./list-storage";

type ResourceHistory = { samples: Record<string, MetricSample[]> };

export type ResourceHistoryStore = ResourceHistory & {
  record: (sandboxId: string, status: SandboxStatus, t: number) => void;
};

export const useResourceHistoryStore = create<ResourceHistoryStore>()(
  persist(
    (set) => ({
      samples: {},
      record: (sandboxId, status, t) => {
        const sample = sampleFromStatus(status, t);
        if (!sample) return;
        set((state) => ({
          samples: trimSandboxes({ ...state.samples, [sandboxId]: appendSample(state.samples[sandboxId] ?? [], sample) }),
        }));
      },
    }),
    {
      name: RESOURCE_HISTORY_STORE_NAME,
      version: RESOURCE_HISTORY_STORE_VERSION,
      storage: createJSONStorage(() => listStorage),
      partialize: ({ samples }): ResourceHistory => ({ samples }),
      merge: (persisted, current) => {
        const stored = (persisted as Partial<ResourceHistory> | undefined)?.samples;
        if (!stored || typeof stored !== "object") return current;
        const now = Date.now();
        const ids = new Set([...Object.keys(stored), ...Object.keys(current.samples)]);
        const samples = Object.fromEntries(
          [...ids].map((id) => [
            id,
            mergeSamples(Array.isArray(stored[id]) ? stored[id] : [], current.samples[id] ?? [], now),
          ]),
        );
        return { ...current, samples: trimSandboxes(samples) };
      },
    },
  ),
);
