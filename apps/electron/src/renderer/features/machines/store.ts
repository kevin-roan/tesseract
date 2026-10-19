import { create } from "zustand";

export type MachineDialog =
  | { kind: "add" }
  | { kind: "rename"; id: string }
  | { kind: "host-link"; id: string }
  | { kind: "remove"; id: string };

interface MachineDialogStore {
  dialog: MachineDialog | null;
  open(dialog: MachineDialog): void;
  close(): void;
}

export const useMachineDialogs = create<MachineDialogStore>((set) => ({
  dialog: null,
  open: (dialog) => set({ dialog }),
  close: () => set({ dialog: null }),
}));

export const openMachineDialog = (dialog: MachineDialog): void => useMachineDialogs.getState().open(dialog);

export function dialogMachineId(dialog: MachineDialog | null, kind: Exclude<MachineDialog["kind"], "add">): string | null {
  return dialog?.kind === kind ? dialog.id : null;
}
