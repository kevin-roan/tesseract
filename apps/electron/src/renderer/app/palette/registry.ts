import { useEffect } from "react";
import { create } from "zustand";
import type { PaletteCommand } from "./types";

interface PaletteRegistryState {
  sources: Record<string, readonly PaletteCommand[]>;
  order: string[];
  register(source: string, commands: readonly PaletteCommand[]): void;
  unregister(source: string): void;
}

export const usePaletteRegistry = create<PaletteRegistryState>((set) => ({
  sources: {},
  order: [],
  register: (source, commands) =>
    set((state) => ({
      sources: { ...state.sources, [source]: commands },
      order: state.order.includes(source) ? state.order : [...state.order, source],
    })),
  unregister: (source) =>
    set((state) => {
      const { [source]: _removed, ...sources } = state.sources;
      return { sources, order: state.order.filter((item) => item !== source) };
    }),
}));

export function registerPaletteCommands(source: string, commands: readonly PaletteCommand[]): () => void {
  usePaletteRegistry.getState().register(source, commands);
  return () => usePaletteRegistry.getState().unregister(source);
}

export function registeredCommands(state: Pick<PaletteRegistryState, "sources" | "order">): PaletteCommand[] {
  return state.order.flatMap((source) => state.sources[source] ?? []);
}

export function usePaletteCommands(source: string, commands: readonly PaletteCommand[]): void {
  useEffect(() => {
    usePaletteRegistry.getState().register(source, commands);
  }, [source, commands]);
  useEffect(() => () => usePaletteRegistry.getState().unregister(source), [source]);
}
