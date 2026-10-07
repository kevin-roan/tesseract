import { create } from "zustand";

/** A message sent while Claude was still working, held until the run ends. */
export type QueuedMessage = { id: string; prompt: string; attachmentIds: string[] };

type QueueStore = {
  /** Queued messages per run they wait on, oldest first. */
  queues: Record<string, QueuedMessage[]>;
  enqueue: (runId: string, message: Omit<QueuedMessage, "id">) => void;
  remove: (runId: string, id: string) => void;
  /** Empties a run's queue and hands back what was in it. */
  take: (runId: string) => QueuedMessage[];
};

let nextId = 0;

export const useQueueStore = create<QueueStore>()((set, get) => ({
  queues: {},
  enqueue: (runId, message) =>
    set((state) => ({
      queues: { ...state.queues, [runId]: [...(state.queues[runId] ?? []), { ...message, id: `queued-${++nextId}` }] },
    })),
  remove: (runId, id) =>
    set((state) => ({
      queues: { ...state.queues, [runId]: (state.queues[runId] ?? []).filter((message) => message.id !== id) },
    })),
  take: (runId) => {
    const taken = get().queues[runId] ?? [];
    if (taken.length === 0) return taken;
    set((state) => {
      const { [runId]: _taken, ...rest } = state.queues;
      return { queues: rest };
    });
    return taken;
  },
}));

const EMPTY: QueuedMessage[] = [];

export const useQueuedMessages = (runId: string) => useQueueStore((state) => state.queues[runId] ?? EMPTY);

/** Queued messages go out as one follow-up, in the order they were written. */
export function combineQueued(messages: readonly QueuedMessage[]): { prompt: string; attachmentIds: string[] } {
  return {
    prompt: messages.map((message) => message.prompt).join("\n\n"),
    attachmentIds: messages.flatMap((message) => message.attachmentIds),
  };
}
