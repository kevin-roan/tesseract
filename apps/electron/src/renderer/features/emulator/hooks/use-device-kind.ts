import { useMemo, useState } from "react";
import { deviceKind, DEVICE_KINDS } from "../devices";
import type { DeviceKindId } from "../types";

export function useDeviceKind() {
  const [id, setId] = useState<DeviceKindId>(DEVICE_KINDS[0]?.id ?? "android");
  const options = useMemo(() => DEVICE_KINDS.map((kind) => ({ id: kind.id, label: kind.label, icon: kind.icon })), []);
  return { kind: deviceKind(id), options, select: setId, switchable: options.length > 1 };
}
