import { useState } from "react";

export function useRebuildConfirm() {
  const [open, setOpen] = useState(false);
  return { open, show: () => setOpen(true), close: () => setOpen(false) };
}
