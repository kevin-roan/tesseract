import { NativeModule, requireOptionalNativeModule, type EventSubscription } from "expo-modules-core";

import type {
  CapturedImage,
  CropRect,
  IslandAction,
  IslandEvents,
  IslandPushToken,
  IslandState,
  RecognizedText,
  ScreenCaptureSource,
  SharedItem,
} from "./src/types";

export * from "./src/types";

declare class TheoneIslandNative extends NativeModule<IslandEvents> {
  isLiveActivitySupported(): boolean;
  /** Starts (or replaces) the Live Activity / ongoing notification and returns its id. */
  startActivity(state: IslandState): Promise<string | null>;
  updateActivity(state: IslandState): Promise<void>;
  endActivity(): Promise<void>;
  currentActivityId(): string | null;
  /** Actions queued while the app was not running (LiveActivityIntent, notification tap). */
  drainActions(): Promise<IslandAction[]>;
  /** Snapshot of the app's own window (`app`), or of the whole screen where the platform allows it (`screen`, Android MediaProjection). */
  captureScreen(source: ScreenCaptureSource): Promise<CapturedImage>;
  canCaptureScreen(source: ScreenCaptureSource): boolean;
  cropImage(uri: string, rect: CropRect): Promise<CapturedImage>;
  recognizeText(uri: string): Promise<RecognizedText>;
  /** Moves the items left by the share extension / share intent into the app's cache and clears the inbox. */
  takeSharedItems(): Promise<SharedItem[]>;
}

const native = requireOptionalNativeModule<TheoneIslandNative>("TheoneIsland");

const unsupported = (): never => {
  throw new Error("The island module is not available on this platform");
};

export const isIslandAvailable = (): boolean => native !== null;

export const isLiveActivitySupported = (): boolean => native?.isLiveActivitySupported() ?? false;

export const startActivity = (state: IslandState): Promise<string | null> =>
  native ? native.startActivity(state) : Promise.resolve(null);

export const updateActivity = (state: IslandState): Promise<void> =>
  native ? native.updateActivity(state) : Promise.resolve();

export const endActivity = (): Promise<void> => (native ? native.endActivity() : Promise.resolve());

export const currentActivityId = (): string | null => native?.currentActivityId() ?? null;

export const drainActions = (): Promise<IslandAction[]> => (native ? native.drainActions() : Promise.resolve([]));

export const canCaptureScreen = (source: ScreenCaptureSource): boolean => native?.canCaptureScreen(source) ?? false;

export const captureScreen = (source: ScreenCaptureSource = "app"): Promise<CapturedImage> =>
  native ? native.captureScreen(source) : unsupported();

export const cropImage = (uri: string, rect: CropRect): Promise<CapturedImage> =>
  native ? native.cropImage(uri, rect) : unsupported();

export const recognizeText = (uri: string): Promise<RecognizedText> =>
  native ? native.recognizeText(uri) : Promise.resolve({ text: "", blocks: [] });

export const takeSharedItems = (): Promise<SharedItem[]> => (native ? native.takeSharedItems() : Promise.resolve([]));

const noop: EventSubscription = { remove: () => undefined };

export const addIslandActionListener = (listener: (event: IslandAction) => void): EventSubscription =>
  native ? native.addListener("onIslandAction", listener) : noop;

export const addPushTokenListener = (listener: (event: IslandPushToken) => void): EventSubscription =>
  native ? native.addListener("onPushToken", listener) : noop;

export const addSharedItemsListener = (listener: (event: { count: number }) => void): EventSubscription =>
  native ? native.addListener("onSharedItems", listener) : noop;
