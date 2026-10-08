import {
  ANDROID_STREAM_ENCODINGS,
  LIMITS,
  type AndroidDevice,
  type AndroidStreamEncoding,
  type AndroidStreamSettings,
  type UpdateAndroidStream,
} from "@tesseract/protocol";

import type { MenuOption } from "@/components/menu-sheet/types";

import { STREAM_BITS_PER_MBIT, STREAM_HOST_EMULATOR, STREAM_MAX_SIZES, STREAM_VIEWER_SIZE } from "./constants";
import { ANDROID_COPY, STREAM_COPY } from "./content";

export const STREAM_RANGES = {
  maxFps: { min: 1, max: LIMITS.maxAndroidFps },
  keyFrameInterval: { min: 1, max: LIMITS.maxAndroidKeyFrameInterval },
  jpegQuality: { min: LIMITS.minAndroidJpegQuality, max: LIMITS.maxAndroidJpegQuality },
} as const;

/** The draft fields that differ from the saved settings. */
export function streamChanges(saved: AndroidStreamSettings, draft: UpdateAndroidStream): UpdateAndroidStream {
  return Object.fromEntries(
    Object.entries(draft).filter(([key, value]) => saved[key as keyof AndroidStreamSettings] !== value),
  ) as UpdateAndroidStream;
}

export const toMbit = (bitRate: number): number => bitRate / STREAM_BITS_PER_MBIT;

export const fromMbit = (mbit: number): number => Math.round(mbit * STREAM_BITS_PER_MBIT);

export const encodingOptions = (): MenuOption[] =>
  ANDROID_STREAM_ENCODINGS.map((id) => ({ id, label: STREAM_COPY.encodings[id], description: STREAM_COPY.encodingDetails[id] }));

export const encodingLabel = (encoding: AndroidStreamEncoding): string => STREAM_COPY.encodings[encoding];

export const maxSizeId = (maxSize: number | null): string => (maxSize === null ? STREAM_VIEWER_SIZE : String(maxSize));

export const maxSizeValue = (id: string): number | null => (id === STREAM_VIEWER_SIZE ? null : Number(id));

export const maxSizeLabel = (maxSize: number | null): string =>
  maxSize === null ? STREAM_COPY.sizeViewer : STREAM_COPY.sizePx(maxSize);

export const maxSizeOptions = (): MenuOption[] =>
  [null, ...STREAM_MAX_SIZES].map((size) => ({ id: maxSizeId(size), label: maxSizeLabel(size) }));

export const streamDeviceId = (device: string | null): string => device ?? STREAM_HOST_EMULATOR;

export const streamDeviceValue = (id: string): string | null => (id === STREAM_HOST_EMULATOR ? null : id);

const describeDevice = (device: AndroidDevice): string =>
  [ANDROID_COPY.deviceKinds[device.kind], device.serial, device.state === "device" ? null : device.state].filter(Boolean).join(" · ");

/** The host emulator first, then every other adb device; a saved device that is gone stays listed. */
export function streamDeviceOptions(devices: AndroidDevice[], saved: string | null): MenuOption[] {
  const options: MenuOption[] = [{ id: STREAM_HOST_EMULATOR, label: STREAM_COPY.deviceHost }];
  for (const device of devices) {
    if (!device.hostEmulator) options.push({ id: device.serial, label: device.model ?? device.serial, description: describeDevice(device) });
  }
  if (saved && options.every((option) => option.id !== saved)) {
    options.push({ id: saved, label: saved, description: STREAM_COPY.deviceMissing });
  }
  return options;
}

export function streamDeviceLabel(devices: AndroidDevice[], device: string | null): string {
  if (device === null) return STREAM_COPY.deviceHost;
  const match = devices.find((item) => item.serial === device);
  return match ? (match.model ?? match.serial) : device;
}
