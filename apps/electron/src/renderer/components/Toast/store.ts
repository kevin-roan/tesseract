import { create } from "zustand";
import { TOAST_TIMEOUT_MS } from "./constants";

export interface ToastAction {
  label: string;
  run(): void;
}

export interface ToastItem {
  id: number;
  message: string;
  timeoutMs: number;
  action?: ToastAction;
  scope: string;
}

interface ToastState {
  queue: ToastItem[];
  push(item: Omit<ToastItem, "id">): number;
  dismiss(id: number): void;
  dropScope(scope: string): void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  queue: [],
  push: (item) => {
    const id = nextId++;
    set((state) => ({ queue: [...state.queue, { ...item, id }] }));
    return id;
  },
  dismiss: (id) => set((state) => ({ queue: state.queue.filter((item) => item.id !== id) })),
  dropScope: (scope) =>
    set((state) => (state.queue.some((item) => item.scope === scope) ? { queue: state.queue.filter((item) => item.scope !== scope) } : state)),
}));

export interface ToastOptions {
  timeoutMs?: number;
  action?: ToastAction;
  scope?: string;
}

export function showToast(message: string, options: ToastOptions = {}): number {
  return useToastStore.getState().push({
    message,
    timeoutMs: options.timeoutMs ?? TOAST_TIMEOUT_MS.default,
    action: options.action,
    scope: options.scope ?? "window",
  });
}
