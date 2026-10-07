import { useState } from "react";

export type HostDialog = "pin" | "rotate" | "pair" | null;

export function useHostDialogs() {
  const [dialog, setDialog] = useState<HostDialog>(null);
  return {
    dialog,
    openPin: () => setDialog("pin"),
    openRotate: () => setDialog("rotate"),
    openPair: () => setDialog("pair"),
    close: () => setDialog(null),
  };
}
