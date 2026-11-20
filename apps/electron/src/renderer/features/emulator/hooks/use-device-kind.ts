import { useCallback, useMemo, useState } from "react";
import { deviceKind, DEVICE_KINDS } from "../devices";
import type { DeviceKindId } from "../types";

export function useDeviceKind() {
  const [id, setId] = useState<DeviceKindId>(DEVICE_KINDS[0]?.id ?? "android");
  const [opened, setOpened] = useState<ReadonlySet<DeviceKindId>>(() => new Set([id]));
  const options = useMemo(() => DEVICE_KINDS.map((kind) => ({ id: kind.id, label: kind.label, icon: kind.icon })), []);
  const panels = useMemo(() => DEVICE_KINDS.filter((kind) => opened.has(kind.id)), [opened]);
  const select = useCallback((next: DeviceKindId) => {
    setId(next);
    setOpened((current) => (current.has(next) ? current : new Set([...current, next])));
  }, []);
  return { kind: deviceKind(id), panels, options, select, switchable: options.length > 1 };
}
