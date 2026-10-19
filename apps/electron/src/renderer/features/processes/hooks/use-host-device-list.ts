import { useMemo } from "react";
import { useHostDevices } from "../../host-shell/hooks/use-host-devices";
import { hostDeviceSnapshots } from "../model";

export function useHostDeviceList() {
  const host = useHostDevices();
  const { android, ios } = host;
  const devices = useMemo(() => hostDeviceSnapshots(android, ios), [android, ios]);
  return { ...host, devices };
}

export type HostDeviceList = ReturnType<typeof useHostDeviceList>;
