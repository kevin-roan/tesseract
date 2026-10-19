import { useCallback } from "react";
import type { EmulatorStopSignal } from "../../../../shared/contracts/hostShell";
import type { HostDeviceKind } from "../types";
import { useHostEmulator } from "./use-host-emulator";
import { useHostSimulator } from "./use-host-simulator";

export function useHostDevices() {
  const emulator = useHostEmulator();
  const simulator = useHostSimulator();
  const { refresh: refreshEmulator, stopWith: stopEmulator } = emulator;
  const { refresh: refreshSimulator, stopWith: stopSimulator } = simulator;

  const refresh = useCallback(() => {
    refreshEmulator();
    refreshSimulator();
  }, [refreshEmulator, refreshSimulator]);

  const stop = useCallback(
    (kind: HostDeviceKind, signal: EmulatorStopSignal): Promise<unknown> => (kind === "ios" ? stopSimulator(signal) : stopEmulator(signal)),
    [stopEmulator, stopSimulator],
  );

  return { android: emulator.status, ios: simulator.status, refresh, stop };
}

export type HostDevices = ReturnType<typeof useHostDevices>;
