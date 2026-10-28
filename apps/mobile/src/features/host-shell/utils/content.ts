import { HOST_PAIRING_ACTION, PAIRING_SCHEME } from "@tesseract/protocol";
import type { IosUnavailableCode, SimState } from "@tesseract/protocol";
import {
  AndroidLogoIcon,
  AppleLogoIcon,
  ArrowSquareOutIcon,
  CheckIcon,
  DeviceMobileIcon,
  GitBranchIcon,
  LinkBreakIcon,
  LinkIcon,
  LockSimpleIcon,
  PlayIcon,
  PlusIcon,
  PowerIcon,
  SkullIcon,
  SlidersHorizontalIcon,
  SparkleIcon,
  StopIcon,
  TerminalWindowIcon,
  TrashIcon,
} from "phosphor-react-native";

import type { HeaderAction } from "@/components/screen-header";
import type { PairingFieldsContent } from "@/features/sandbox/utils/pair-content";

type ActionTemplate = Omit<HeaderAction, "onPress">;

export const HOST_SCREEN = {
  title: "Host shell",
  setupSubtitle: "Pair with the host over your tailnet",
  lockedSubtitle: "Enter the PIN set on the host",
  linkTitle: "Opened from a host link",
  linkChip: "verify",
  linkMessage: "Only pair with a host you own. With the PIN, this gives a full shell on that machine.",
  manualTitle: "Or enter it by hand",
  manualChip: "manual",
  linkFormTitle: "Check the details",
  linkFormChip: "from link",
  pinTitle: "Unlock",
  sessionsTitle: "Shells",
  newShell: "New shell",
  emptyTitle: "No shells open",
  emptyMessage: "Start a login shell on the host. It keeps running when you leave the screen.",
  loadingTitle: "Loading shells…",
  sessionChip: (countdown: string) => `unlocked · ${countdown}`,
  pinMissing: "No PIN is set on the host. Run `bun run host pin` there, then try again.",
  repairTitle: "Pair the host again",
  repair: "Pair again",
  retry: "Retry",
} as const;

export const HOST_QR = {
  title: "Scan the host code",
  footer: `${PAIRING_SCHEME}://${HOST_PAIRING_ACTION}`,
  promptMessage: "Scan the QR code printed by `bun run host pair` on the host.",
} as const;

export const HOST_PAIRING_FIELDS: PairingFieldsContent = {
  url: {
    label: "Host URL",
    hint: "The host's Tailscale address and port, or paste a tesseract://host link.",
    placeholder: "http://100.64.0.1:7701",
  },
  token: {
    label: "Host token",
    hint: "Printed by `bun run host pair` on the host.",
    placeholder: "Host token",
  },
  name: {
    label: "Name (optional)",
    placeholder: "Defaults to the host name",
  },
};

export const HOST_PAIRING_SUBMIT = "Pair host";
export const HOST_PAIRING_VALIDATING = "Checking the host…";

export const HOST_ACTIONS = {
  lock: { id: "lock", icon: LockSimpleIcon, label: "Lock the host shell" },
  newShell: { id: "new-shell", icon: PlusIcon, label: "New shell" },
  unpair: { id: "unpair", icon: TrashIcon, label: "Forget this host", tone: "danger" },
} satisfies Record<string, ActionTemplate>;

export const UNPAIR_CONFIRM = {
  title: "Forget this host?",
  message: "The host token is removed from this phone. Shells on the host keep running.",
  confirmLabel: "Forget host",
  destructive: true,
} as const;

export const CLOSE_CONFIRM = {
  title: "Close this shell?",
  message: "Programs running in it are stopped. Leaving the screen instead keeps the shell alive.",
  confirmLabel: "Close shell",
  destructive: true,
} as const;

export const LINK_CONFIRM = {
  title: "Link this sandbox?",
  message: "The host keeps this sandbox's access token so the emulator can stay connected to it until you unlink.",
  confirmLabel: "Link sandbox",
} as const;

export const HOST_LOCKED = "The host shell is locked.";
export const HOST_NO_SANDBOX = "Pair a sandbox first, then pair its host.";

export const PROFILE_ENTRY = {
  title: "Host shell",
  unpaired: "Not paired · PIN protected",
  paired: (name: string) => `${name} · PIN protected`,
} as const;

export const ANDROID_COPY = {
  title: "Android emulator",
  screenTitle: "Android",
  emulator: "Emulator",
  noAvd: "No AVD",
  avdSheetTitle: "Virtual device",
  avdFootnote: "AVDs from `emulator -list-avds` on the host.",
  start: "Start",
  stop: "Stop",
  forceKill: "Force kill",
  openScreen: "Open screen",
  link: "Link sandbox",
  unlink: "Unlink",
  linkTitle: "Sandbox link",
  linkMessage: "Lets the sandbox's adb, Expo, React Native and Flutter runs install on this emulator.",
  noSandbox: "Pair a sandbox first, then link it to the emulator.",
  notLinked: "Not linked to a sandbox",
  adopted: "adopted",
  isolation: { isolated: "isolated", notIsolated: "not isolated" },
  notIsolatedTitle: "Emulator not isolated",
  notIsolated:
    "This emulator was started outside the app, so it shares the host's network. Stop it and start it here to link a sandbox.",
  isolationOffTitle: "Network isolation is off",
  isolationOff:
    "The host runs the emulator with TESSERACT_EMULATOR_ISOLATION=none, so the guest can reach the host's loopback services, LAN and tailnet. Sandbox runs will not use it.",
  linkBlocked: "Linking is disabled while the emulator is not isolated; start it from the app.",
  unavailable: "The Android emulator is not available on this host.",
  linkStates: { none: "Not linked", connected: "Connected", connecting: "Connecting", failed: "Disconnected" },
  retry: "Retry",
  screenCardTitle: "Screen sharing",
  noDevice: "No device",
  noDevices: "No adb device is connected to the host. Start the emulator, Genymotion, or plug in a phone.",
  deviceSheetTitle: "Device",
  deviceFootnote: "Devices from `adb devices` on the host. The host streams H.264 when this phone can decode it.",
  deviceKinds: { emulator: "Emulator", genymotion: "Genymotion", network: "Wi-Fi", usb: "USB" },
} as const;

export const HOST_DEVICE_COPY = {
  unsupported: "This app can't show that device's screen yet. Update the app.",
  kindLabel: "Device",
  kinds: { android: "Android", ios: "iOS" },
} as const;

export const EMULATOR_KILL_CONFIRM = {
  title: "Force kill the emulator?",
  message: "The emulator is killed at once without shutting Android down. Unsaved state in the emulator is lost.",
  confirmLabel: "Force kill",
  destructive: true,
} as const;

export const SIMULATOR_KILL_CONFIRM = {
  title: "Force kill the simulator?",
  message: "The simulator's processes are killed at once before it shuts down. Unsaved state in its apps is lost.",
  confirmLabel: "Force kill",
  destructive: true,
} as const;

const SIM_STATE_LABELS: Record<SimState, string> = {
  unavailable: "Unavailable",
  shutdown: "Shut down",
  booting: "Booting",
  booted: "Booted",
  shutting_down: "Shutting down",
  failed: "Failed",
};

const IOS_UNAVAILABLE: Record<IosUnavailableCode, { title: string; message: string }> = {
  disabled: {
    title: "iOS Simulator is off",
    message: "Start the host daemon with TESSERACT_IOS=1 to use the iOS Simulator.",
  },
  not_macos: {
    title: "Needs a Mac",
    message: "The iOS Simulator only runs on a macOS host with Xcode.",
  },
  no_xcode: {
    title: "Xcode is missing",
    message: "Install Xcode with the iOS Simulator on the host, then run `sudo xcode-select -s /Applications/Xcode.app`.",
  },
  no_idb: {
    title: "idb is missing",
    message: "Install idb and idb_companion on the host (`brew install facebook/fb/idb-companion` and `pip3 install fb-idb`).",
  },
};

export const IOS_COPY = {
  title: "iOS Simulator",
  screenTitle: "iOS",
  simulator: "Simulator",
  noDevice: "No simulator",
  noDevices: "No simulator device on the host. Add one in Xcode under Window › Devices and Simulators.",
  deviceSheetTitle: "Simulator",
  deviceFootnote: "Devices from `xcrun simctl list` on the host. One device runs at a time.",
  boot: "Boot",
  shutdown: "Shut down",
  forceKill: "Force kill",
  openScreen: "Open screen",
  otherBooted: (name: string) => `${name} is running; shut it down to boot another device.`,
  unavailable: "The iOS Simulator is not available on this host.",
  unavailableReasons: IOS_UNAVAILABLE,
  states: SIM_STATE_LABELS,
  retry: "Retry",
} as const;

export const STREAM_COPY = {
  title: "Stream settings",
  subtitle: "How the host streams the Android screen",
  iosSubtitle: "How the host streams the iOS Simulator screen",
  open: "Stream settings",
  deviceGroup: "Device",
  device: "Default device",
  deviceDetail: "Screens open this one unless you pick another",
  deviceSheetTitle: "Default device",
  deviceFootnote: "Devices from `adb devices` on the host.",
  deviceHost: "Host emulator",
  deviceMissing: "Not connected",
  videoGroup: "Video",
  videoFootnote: "Saved settings switch every open screen over within a moment.",
  iosVideoFootnote:
    "Saved settings switch every open screen over within a moment. H.264 needs tesseract-simcap on the Mac; without it the host sends JPEG.",
  encoding: "Encoding",
  encodingDetail: "H.264 is decoded on the phone; JPEG is the fallback",
  encodingSheetTitle: "Encoding",
  encodings: { h264: "H.264", mjpeg: "JPEG only" },
  encodingDetails: { h264: "Recommended; sent as-is from the device", mjpeg: "Works everywhere, uses more data" },
  bitRate: "Bitrate",
  bitRateDetail: "Mbit/s of H.264; lower it on slow or relayed links",
  bitRateValue: (mbit: number) => `${mbit} Mbit/s`,
  maxFps: "Frame rate limit",
  maxFpsDetail: "Frames per second at most",
  maxSize: "Resolution limit",
  maxSizeDetail: "Longest side of the streamed screen",
  maxSizeSheetTitle: "Resolution limit",
  sizeViewer: "Match the phone",
  sizePx: (size: number) => `${size} px`,
  keyFrameInterval: "Key frame interval",
  keyFrameIntervalDetail: "Seconds; shorter recovers faster from dropped frames",
  jpegQuality: "JPEG quality",
  jpegQualityDetail: "2 is the best, 31 the smallest",
  decrease: "Decrease",
  increase: "Increase",
  reset: "Reset to defaults",
  save: "Save",
  saved: "Saved. Open screens switch to the new settings.",
  retry: "Retry",
} as const;

export const ANDROID_ICONS = {
  emulator: AndroidLogoIcon,
  device: DeviceMobileIcon,
  start: PlayIcon,
  stop: StopIcon,
  open: ArrowSquareOutIcon,
  link: LinkIcon,
  unlink: LinkBreakIcon,
  settings: SlidersHorizontalIcon,
  forceKill: SkullIcon,
} as const;

export const IOS_ICONS = {
  simulator: AppleLogoIcon,
  boot: PowerIcon,
  shutdown: StopIcon,
  forceKill: SkullIcon,
  open: ArrowSquareOutIcon,
  device: DeviceMobileIcon,
  settings: SlidersHorizontalIcon,
} as const;

export const HOST_PROJECT_COPY = {
  title: "This computer",
  accountTitle: "Claude on this computer",
  claude: "Claude",
  shell: "Shell",
  git: "Git",
  gitTitle: "Git on this computer",
  pull: "Pull",
  push: "Push",
  commit: "Commit all…",
  pullHint: "git pull --ff-only",
  pushHint: "git push",
  commitHint: "Stage every change and commit it",
  commitTitle: "Commit all changes",
  commitLabel: "Commit message",
  commitSave: "Commit",
  connect: "Unlock the host shell once to reach this project's copy on your computer.",
  connectAction: "Unlock",
  missing: "No copy on this computer yet. Sync the project from a folder there in the desktop app.",
  warning: "Claude and the shell run on your computer, outside the sandbox.",
  done: {
    pull: (summary: string) => `Pulled: ${summary}`,
    push: (summary: string) => `Pushed: ${summary}`,
    commit: (summary: string) => `Committed: ${summary}`,
  },
  failed: {
    pull: (error: string) => `git pull failed on this computer: ${error}`,
    push: (error: string) => `git push failed on this computer: ${error}`,
    commit: (error: string) => `git commit failed on this computer: ${error}`,
  },
  upToDate: "Already up to date",
  dismiss: "Dismiss",
} as const;

export const HOST_PROJECT_ICONS = { claude: SparkleIcon, shell: TerminalWindowIcon, git: GitBranchIcon, commit: CheckIcon };
