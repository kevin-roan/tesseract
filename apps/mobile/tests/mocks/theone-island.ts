import type {
  CapturedImage,
  CropRect,
  IslandAction,
  IslandPushToken,
  IslandState,
  RecognizedText,
  ScreenCaptureSource,
  SharedItem,
} from "../../modules/theone-island/src/types";

export * from "../../modules/theone-island/src/types";

type Listener<T> = (event: T) => void;

const actionListeners = new Set<Listener<IslandAction>>();
const tokenListeners = new Set<Listener<IslandPushToken>>();
const sharedListeners = new Set<Listener<{ count: number }>>();

let activityId: string | null = null;
let queuedActions: IslandAction[] = [];
let queuedShared: SharedItem[] = [];

const subscription = <T>(set: Set<Listener<T>>, listener: Listener<T>) => {
  set.add(listener);
  return { remove: () => set.delete(listener) };
};

export const isIslandAvailable = jest.fn(() => true);
export const isLiveActivitySupported = jest.fn(() => true);
export const startActivity = jest.fn(async (_state: IslandState) => {
  activityId = "activity-1";
  return activityId;
});
export const updateActivity = jest.fn(async (_state: IslandState) => undefined);
export const endActivity = jest.fn(async () => {
  activityId = null;
});
export const currentActivityId = jest.fn(() => activityId);
export const drainActions = jest.fn(async () => {
  const drained = queuedActions;
  queuedActions = [];
  return drained;
});
export const canCaptureScreen = jest.fn((_source: ScreenCaptureSource) => false);
export const captureScreen = jest.fn(
  async (_source: ScreenCaptureSource = "app"): Promise<CapturedImage> => ({ uri: "file:///cache/capture.png", width: 1080, height: 2400 }),
);
export const cropImage = jest.fn(
  async (uri: string, rect: CropRect): Promise<CapturedImage> => ({ uri: `${uri}#crop`, width: rect.width, height: rect.height }),
);
export const recognizeText = jest.fn(async (_uri: string): Promise<RecognizedText> => ({ text: "", blocks: [] }));
export const takeSharedItems = jest.fn(async () => {
  const taken = queuedShared;
  queuedShared = [];
  return taken;
});
export const addIslandActionListener = jest.fn((listener: Listener<IslandAction>) => subscription(actionListeners, listener));
export const addPushTokenListener = jest.fn((listener: Listener<IslandPushToken>) => subscription(tokenListeners, listener));
export const addSharedItemsListener = jest.fn((listener: Listener<{ count: number }>) => subscription(sharedListeners, listener));

export function __emitAction(action: IslandAction): void {
  actionListeners.forEach((listener) => listener(action));
}

export function __emitPushToken(token: IslandPushToken): void {
  tokenListeners.forEach((listener) => listener(token));
}

export function __emitSharedItems(items: SharedItem[]): void {
  queuedShared = [...queuedShared, ...items];
  sharedListeners.forEach((listener) => listener({ count: items.length }));
}

export function __queueActions(actions: IslandAction[]): void {
  queuedActions = [...queuedActions, ...actions];
}

export function __reset(): void {
  actionListeners.clear();
  tokenListeners.clear();
  sharedListeners.clear();
  activityId = null;
  queuedActions = [];
  queuedShared = [];
  for (const fn of [
    isIslandAvailable,
    isLiveActivitySupported,
    startActivity,
    updateActivity,
    endActivity,
    currentActivityId,
    drainActions,
    canCaptureScreen,
    captureScreen,
    cropImage,
    recognizeText,
    takeSharedItems,
    addIslandActionListener,
    addPushTokenListener,
    addSharedItemsListener,
  ]) {
    fn.mockClear();
  }
}
