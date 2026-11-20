export const DEVICE_WINDOW_KINDS = ["android", "ios"] as const;
export type DeviceWindowKind = (typeof DEVICE_WINDOW_KINDS)[number];

export const DEVICE_WINDOW_CHROME = { toolbar: 40, bezel: 8 } as const;

export interface DeviceWindowSize {
  width: number;
  height: number;
}

export function isDeviceWindowKind(value: unknown): value is DeviceWindowKind {
  return (DEVICE_WINDOW_KINDS as readonly unknown[]).includes(value);
}
