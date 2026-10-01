import { useCallback, useMemo, useState } from "react";

export function useDrawerState() {
  const [visible, setVisible] = useState(false);
  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);
  return useMemo(() => ({ visible, open, close }), [visible, open, close]);
}
