import { useMemo, useState } from "react";
import type { HostAndroidStatus, HostIosStatus } from "@tesseract/protocol";

import type { SegmentedOption } from "@/components/segmented-pills";

import type { HostDeviceKind } from "../types";
import { HOST_DEVICE_COPY } from "../utils/content";
import { deviceKindFor, offersBothKinds } from "../utils/devices";

export function useHostDeviceKind(android: HostAndroidStatus | undefined, ios: HostIosStatus | undefined) {
  const [picked, setPicked] = useState<HostDeviceKind | null>(null);
  const options = useMemo<SegmentedOption<HostDeviceKind>[]>(
    () => (["android", "ios"] as const).map((value) => ({ value, label: HOST_DEVICE_COPY.kinds[value] })),
    [],
  );

  return {
    kind: deviceKindFor(picked, android, ios),
    offered: offersBothKinds(ios),
    options,
    label: HOST_DEVICE_COPY.kindLabel,
    select: setPicked,
  };
}

export type HostDeviceKindState = ReturnType<typeof useHostDeviceKind>;
