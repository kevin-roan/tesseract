import { DEFAULT_ANDROID_STREAM, type AndroidDevice, type AndroidStreamSettings } from "@tesseract/protocol";

import { stepValue } from "@/components/list-group";
import { STREAM_HOST_EMULATOR, STREAM_VIEWER_SIZE } from "@/features/host-shell/utils/constants";
import { STREAM_COPY } from "@/features/host-shell/utils/content";
import {
  fromMbit,
  maxSizeId,
  maxSizeLabel,
  maxSizeOptions,
  maxSizeValue,
  streamChanges,
  streamDeviceId,
  streamDeviceLabel,
  streamDeviceOptions,
  streamDeviceValue,
  toMbit,
} from "@/features/host-shell/utils/stream";

const saved: AndroidStreamSettings = { ...DEFAULT_ANDROID_STREAM };

const device = (overrides: Partial<AndroidDevice> = {}): AndroidDevice => ({
  serial: "R58M123",
  state: "device",
  kind: "usb",
  model: "Pixel 8",
  hostEmulator: false,
  ...overrides,
});

describe("stream settings helpers", () => {
  it("keeps only the draft fields that differ from the saved settings", () => {
    expect(streamChanges(saved, { maxFps: 60, bitRate: 4_000_000 })).toEqual({ bitRate: 4_000_000 });
    expect(streamChanges(saved, { ...DEFAULT_ANDROID_STREAM })).toEqual({});
  });

  it("converts the bitrate between bits and Mbit/s", () => {
    expect(toMbit(6_500_000)).toBe(6.5);
    expect(fromMbit(6.5)).toBe(6_500_000);
  });

  it("maps a null resolution limit to the phone's own size", () => {
    expect(maxSizeId(null)).toBe(STREAM_VIEWER_SIZE);
    expect(maxSizeValue(STREAM_VIEWER_SIZE)).toBeNull();
    expect(maxSizeValue("1080")).toBe(1080);
    expect(maxSizeLabel(null)).toBe(STREAM_COPY.sizeViewer);
    expect(maxSizeOptions()[0]?.id).toBe(STREAM_VIEWER_SIZE);
  });

  it("lists the host emulator first, other devices next, and keeps a saved device that is gone", () => {
    const options = streamDeviceOptions([device({ serial: "emulator-5554", hostEmulator: true }), device()], "192.168.1.9:5555");
    expect(options.map((option) => option.id)).toEqual([STREAM_HOST_EMULATOR, "R58M123", "192.168.1.9:5555"]);
    expect(options[2]?.description).toBe(STREAM_COPY.deviceMissing);
  });

  it("maps the host emulator to a null device", () => {
    expect(streamDeviceId(null)).toBe(STREAM_HOST_EMULATOR);
    expect(streamDeviceValue(STREAM_HOST_EMULATOR)).toBeNull();
    expect(streamDeviceLabel([device()], "R58M123")).toBe("Pixel 8");
    expect(streamDeviceLabel([], null)).toBe(STREAM_COPY.deviceHost);
  });

  it("steps a value within its range without float drift", () => {
    expect(stepValue(0.1, 0.2, 0, 1)).toBe(0.3);
    expect(stepValue(50, 0.5, 0.5, 50)).toBe(50);
    expect(stepValue(1, -1, 1, 10)).toBe(1);
  });
});
