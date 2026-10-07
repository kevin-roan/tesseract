import { useEffect, useSyncExternalStore } from "react";
import { type AccelGuard, accelGuard } from "./accel-guard";

export function useAccelGuard(active: boolean, guard: AccelGuard = accelGuard): void {
  useEffect(() => {
    if (!active) return;
    return guard.acquire();
  }, [active, guard]);
}

export function useAccelGuardActive(guard: AccelGuard = accelGuard): boolean {
  return useSyncExternalStore(
    (onChange) => guard.subscribe(onChange),
    () => guard.active,
    () => false,
  );
}
