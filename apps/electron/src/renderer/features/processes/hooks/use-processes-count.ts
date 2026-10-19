import { runningCount } from "../model";
import { useHostDeviceList } from "./use-host-device-list";
import { useRuntimeList } from "./use-runtime-list";

export function useProcessesCount(): number | null {
  const { entries } = useRuntimeList();
  const { devices } = useHostDeviceList();
  const count = runningCount(entries, devices);
  return count > 0 ? count : null;
}
