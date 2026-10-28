import type { EmulatorState, IosUnavailableCode } from "@tesseract/protocol";
import type { DeviceKindId, DeviceLabels, ScreenStatus } from "./types";

export const EMULATOR_PAGE_LABELS = {
  title: "Emulator",
  kinds: "Device",
  screen: "Device screen",
  keys: "Device keys",
  screenHint: "Click the screen to type into the device",
} as const;

export const DEVICE_KIND_LABELS: Record<DeviceKindId, string> = {
  android: "Android",
  ios: "iOS",
};

export const ANDROID_KEY_LABELS = {
  back: "Back",
  home: "Home",
  recents: "Recent apps",
  rotate: "Rotate",
  volumeDown: "Volume down",
  volumeUp: "Volume up",
  power: "Power",
} as const;

export const IOS_KEY_LABELS = {
  home: "Home",
  lock: "Lock",
} as const;

export const EMULATOR_STATE_LABELS: Record<EmulatorState, string> = {
  unavailable: "Unavailable",
  stopped: "Stopped",
  starting: "Starting…",
  running: "Running",
  stopping: "Stopping…",
  failed: "Failed",
};

export const SCREEN_STATUS_LABELS: Record<ScreenStatus, string> = {
  idle: "Not connected",
  connecting: "Connecting…",
  connected: "Live",
  disconnected: "Disconnected",
  error: "Stream error",
};

export const CONTROL_LABELS = {
  start: "Start",
  stop: "Stop",
  kill: "Force kill",
  refresh: "Refresh",
  link: "Link to sandbox",
  relink: "Link again",
} as const;

export const ANDROID_LABELS: DeviceLabels = {
  noTargets: "No virtual devices",
  noTargetsMessage: "Create an Android virtual device in the Android settings first.",
  target: "Virtual device",
  killTooltip: "Kill the emulator process right away (SIGKILL)",
  unavailable: "The emulator is not available on this computer",
  overlay: {
    stopped: { title: "The emulator is off", message: "Start a virtual device to see its screen here." },
    starting: { title: "Booting the emulator…", message: "The screen appears once Android is up." },
    stopping: { title: "Stopping the emulator…", message: null },
    failed: { title: "The emulator failed", message: null },
    unavailable: { title: "No emulator on this computer", message: null },
  },
};

export const IOS_LABELS: DeviceLabels = {
  noTargets: "No simulators",
  noTargetsMessage: "Add an iOS simulator in Xcode first.",
  target: "Simulator",
  killTooltip: "Kill the simulator's processes right away (SIGKILL), then shut it down",
  unavailable: "The iOS Simulator is not available on this host",
  overlay: {
    stopped: { title: "The simulator is off", message: "Boot a simulator to see its screen here." },
    starting: { title: "Booting the simulator…", message: "The screen appears once iOS is up." },
    stopping: { title: "Shutting the simulator down…", message: null },
    failed: { title: "The simulator failed", message: null },
    unavailable: { title: "No iOS Simulator on this host", message: null },
  },
};

export const IOS_UNAVAILABLE_LABELS: Record<IosUnavailableCode, string> = {
  disabled: "The iOS Simulator is turned off on this host (TESSERACT_IOS).",
  not_macos: "The iOS Simulator needs a Mac. Link a macOS host to this machine to use it.",
  no_xcode: "Xcode is not installed on this Mac. Install Xcode and its command line tools (xcrun simctl).",
  no_idb: "idb is not installed on this Mac. Install idb and idb_companion to stream and drive the simulator.",
};

export const LINK_LABELS = {
  title: "Sandbox link",
  linked: "Linked",
  connected: "Connected",
  disconnected: "Not connected",
  notLinked: "Not linked",
  otherSandbox: "Linked to another sandbox",
  noSandbox: "Connect to a sandbox to link the emulator",
} as const;

export const OVERLAY_LABELS = {
  connecting: { title: "Connecting to the screen…", message: null },
  disconnected: { title: "Screen disconnected", message: null },
  error: { title: "The screen stream failed", message: null },
  reconnect: "Reconnect",
} as const;

export const STREAM_LABELS = {
  open: "Stream",
  tooltip: "Video quality of the screen stream",
  title: "Stream settings",
  context: (device: string) => `${device} screen`,
  subtitle: "Saving restarts the stream on the host; open screens switch over within a moment.",
  save: "Save",
  cancel: "Cancel",
  loading: "Loading the stream settings…",
  saved: "Stream settings saved",
  failed: (message: string) => `Could not save the stream settings: ${message}`,
  noHost: "The host shell is not connected",
  encoding: "Encoding",
  encodings: { h264: "H.264", mjpeg: "JPEG" },
  encodingHint: "H.264 is decoded here when this computer can; JPEG works everywhere but uses more bandwidth.",
  bitRate: "Bit rate (Mbit/s)",
  maxFps: "Max frame rate",
  maxSize: "Max size",
  sizeAuto: "Auto",
  sizePx: (size: number) => `${size} px`,
  keyFrameInterval: "Key frame interval (s)",
  jpegQuality: "JPEG quality",
  jpegQualityHint: "JPEG quality: 2 is the best, 31 the smallest.",
  invalid: (label: string, min: number, max: number) => `${label} must be between ${min} and ${max}`,
} as const;
