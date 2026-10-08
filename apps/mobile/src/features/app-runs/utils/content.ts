import type { AppRunAction, AppRunState, AppViewerKind } from "@tesseract/protocol";
import {
  AndroidLogoIcon,
  ArrowClockwiseIcon,
  ArrowsClockwiseIcon,
  ArrowSquareOutIcon,
  CompassIcon,
  CrosshairIcon,
  DeviceMobileIcon,
  GlobeIcon,
  MonitorIcon,
  TestTubeIcon,
  type Icon,
} from "phosphor-react-native";

import type { HeaderAction } from "@/components/screen-header";
import type { Tone } from "@/lib/tone";

import type { EmulatorAction } from "./runs";

type ActionTemplate = Omit<HeaderAction, "onPress">;

export const VIEWER_ICONS: Record<AppViewerKind, Icon> = {
  url: GlobeIcon,
  deeplink: DeviceMobileIcon,
  display: MonitorIcon,
  android: AndroidLogoIcon,
  none: TestTubeIcon,
};

export const VIEWER_DESCRIPTIONS: Record<AppViewerKind, string> = {
  url: "Opens in the in-app browser",
  deeplink: "Opens in Expo on this phone",
  display: "Draws on the sandbox display",
  android: "Runs on the host emulator",
  none: "Logs only",
};

export const OPEN_LABELS: Record<AppViewerKind, string> = {
  url: "Open",
  deeplink: "Open in Expo",
  display: "Show display",
  android: "Show emulator",
  none: "Open",
};

export const EMULATOR_ACTION_LABELS: Record<EmulatorAction["kind"], string> = {
  show: "Show emulator",
  start: "Open on emulator",
  setup: "Set up emulator",
};

export const EMULATOR_ACTION_HINTS: Record<EmulatorAction["kind"], string> = {
  show: "Opens the host Android emulator",
  start: "Starts the app and opens the host Android emulator",
  setup: "Opens the host emulator controls",
};

export const RUN_ACTION_LABELS: Record<AppRunAction, string> = {
  reload: "Reload",
  restart: "Restart",
  focus: "Focus",
};

export const RUN_ACTION_ICONS: Record<AppRunAction, Icon> = {
  reload: ArrowClockwiseIcon,
  restart: ArrowsClockwiseIcon,
  focus: CrosshairIcon,
};

export const APP_RUN_TONES: Record<AppRunState, Tone> = {
  starting: "info",
  ready: "success",
  failed: "danger",
  stopped: "neutral",
  exited: "neutral",
};

export const OPEN_ICON = ArrowSquareOutIcon;

export const APP_RUNS_COPY = {
  title: "Run",
  empty: "Nothing to run was detected in this project.",
  start: "Start",
  startAgain: "Start again",
  stop: "Stop",
  logs: "Logs",
  hideLogs: "Hide logs",
  fix: "Fix with AI",
  unavailable: "Unavailable",
  unreachable: "No Tailscale address yet, so this app can't be reached from your phone.",
  deeplinkTitle: "Couldn't open the app",
  deeplinkMessage: (manifestUrl: string) =>
    `Install Expo Go or the project's dev client, then open this URL in it: ${manifestUrl}`,
  copyUrl: "Copy URL",
  copied: "Copied",
} as const;

export const APP_RUN_A11Y = {
  start: (label: string) => `Start ${label}`,
  stop: (label: string) => `Stop ${label}`,
  fix: (label: string) => `Fix ${label} with AI`,
  action: (action: string, label: string) => `${action} ${label}`,
  labelled: (action: string, label: string) => `${action}: ${label}`,
} as const;

export const STOP_RUN_CONFIRM = {
  title: "Stop this app?",
  message: "Its processes are shut down. Start it again from the Run section.",
  confirmLabel: "Stop",
  cancelLabel: "Keep running",
  destructive: true,
} as const;

export const PREVIEW_ACTIONS = {
  reload: { id: "reload", icon: ArrowClockwiseIcon, label: "Reload" },
  browser: { id: "browser", icon: CompassIcon, label: "Open in browser" },
} satisfies Record<string, ActionTemplate>;

export const PREVIEW_COPY = {
  title: "Preview",
  loading: "Loading preview…",
  invalidTitle: "Nothing to show",
  invalidMessage: "This app isn't running in this sandbox or has no web address.",
  failedTitle: "Couldn't load the app",
  retry: "Try again",
} as const;
