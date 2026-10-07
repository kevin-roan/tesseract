import { useEffect } from "react";
import { accelGuard } from "../../components/AccelGuard";
import { ipc } from "../../lib/ipc";

export function useAccelGuardBridge(): void {
  useEffect(
    () =>
      accelGuard.subscribe((active) => {
        ipc.window.setAccelGuard(active).catch(() => undefined);
      }),
    [],
  );
}
