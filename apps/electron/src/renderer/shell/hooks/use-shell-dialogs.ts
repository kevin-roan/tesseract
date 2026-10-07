import { create } from "zustand";
import type { ShellDialog } from "../constants";

interface ShellDialogStore {
  dialog: ShellDialog | null;
  open(dialog: ShellDialog): void;
  close(): void;
}

export const useShellDialogs = create<ShellDialogStore>((set) => ({
  dialog: null,
  open: (dialog) => set({ dialog }),
  close: () => set({ dialog: null }),
}));

export const openShellDialog = (dialog: ShellDialog): void => useShellDialogs.getState().open(dialog);
