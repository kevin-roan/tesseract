import { ANDROID_KEYS, IOS_KEYS, LIMITS, wsPaths, type EmulatorState, type SimState } from "@tesseract/protocol";
import type { Tone } from "../../theme/colors";
import { ANDROID_KEY_LABELS, IOS_KEY_LABELS } from "./labels";
import type { ScreenKey, ScreenSpec, ScreenState, ScreenStatus } from "./types";

export const H264 = { probeCodec: "avc1.42E01F", spsNalType: 7, maxDecodeQueue: 6 } as const;

export const SCREEN_MIME = "image/jpeg";
export const SCREEN_CODEC_H264 = "h264";
export const SCREEN_QUERY = { codec: "codec", maxSize: "maxSize" } as const;
export const SCREEN_RECONNECT_MS = 2_000;

export const INITIAL_SCREEN: ScreenState = { status: "idle", title: null, size: null, error: null };

export const SCREEN_STATUS_TONES: Record<ScreenStatus, Tone> = {
  idle: "neutral",
  connecting: "info",
  connected: "success",
  disconnected: "warning",
  error: "danger",
};

export const EMULATOR_TONES: Record<EmulatorState, Tone> = {
  unavailable: "neutral",
  stopped: "neutral",
  starting: "info",
  running: "success",
  stopping: "warning",
  failed: "danger",
};

const androidKey = (id: (typeof ANDROID_KEYS)[number], icon: ScreenKey["icon"], label: string): ScreenKey => ({
  id,
  label,
  icon,
  message: { type: "key", key: id },
});

export const ANDROID_SCREEN_KEYS: readonly ScreenKey[] = [
  androidKey("back", "back", ANDROID_KEY_LABELS.back),
  androidKey("home", "overview", ANDROID_KEY_LABELS.home),
  androidKey("app_switch", "views", ANDROID_KEY_LABELS.recents),
  { id: "rotate", label: ANDROID_KEY_LABELS.rotate, icon: "rotate", message: { type: "rotate" } },
  androidKey("volume_down", "volumeDown", ANDROID_KEY_LABELS.volumeDown),
  androidKey("volume_up", "volumeUp", ANDROID_KEY_LABELS.volumeUp),
  androidKey("power", "power", ANDROID_KEY_LABELS.power),
];

export const ANDROID_KEYBOARD: Readonly<Record<string, (typeof ANDROID_KEYS)[number]>> = {
  Enter: "enter",
  Backspace: "del",
  Tab: "tab",
  Escape: "escape",
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export const ANDROID_SCREEN: ScreenSpec = {
  path: wsPaths.androidScreen(),
  deviceParam: "serial",
  h264: true,
  keys: ANDROID_SCREEN_KEYS,
  keyboard: ANDROID_KEYBOARD,
  enterKey: "enter",
  maxPointers: LIMITS.maxAndroidPointerId + 1,
  maxTextBytes: LIMITS.maxAndroidTextLength,
  maxScroll: LIMITS.maxAndroidScroll,
  wheelPixelsPerStep: 100,
  wheelLinesPerStep: 3,
};

export const SIM_EMULATOR_STATES: Record<SimState, EmulatorState> = {
  unavailable: "unavailable",
  shutdown: "stopped",
  booting: "starting",
  booted: "running",
  shutting_down: "stopping",
  failed: "failed",
};

const iosKey = (id: (typeof IOS_KEYS)[number], icon: ScreenKey["icon"], label: string): ScreenKey => ({
  id,
  label,
  icon,
  message: { type: "key", key: id },
});

export const IOS_SCREEN_KEYS: readonly ScreenKey[] = [iosKey("home", "overview", IOS_KEY_LABELS.home), iosKey("power", "power", IOS_KEY_LABELS.lock)];

export const IOS_SCREEN: ScreenSpec = {
  ...ANDROID_SCREEN,
  path: wsPaths.iosScreen(),
  deviceParam: "udid",
  h264: false,
  keys: IOS_SCREEN_KEYS,
  maxPointers: 1,
};
