import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { sampleInboxItem } from "@tesseract/protocol/fixtures";

jest.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4 },
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  scheduleNotificationAsync: jest.fn(async () => "id"),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getDevicePushTokenAsync: jest.fn(async () => ({ type: "ios", data: "apns" })),
  getExpoPushTokenAsync: jest.fn(async () => ({ type: "expo", data: "ExponentPushToken[abc]" })),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
}));
let mockIsDevice = true;
jest.mock("expo-device", () => ({
  get isDevice() {
    return mockIsDevice;
  },
  deviceName: "Pixel",
}));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { extra: { eas: { projectId: "proj-1" } } } } }));

const mocked = Notifications as jest.Mocked<typeof Notifications>;

function load() {
  let mod: typeof import("@/features/inbox/notifications") | undefined;
  jest.isolateModules(() => {
    mod = jest.requireActual("@/features/inbox/notifications");
  });
  return mod!;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("inbox notifications", () => {
  it("asks for permission only when the first attention item arrives, then schedules immediately", async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true } as never);
    mocked.requestPermissionsAsync.mockResolvedValue({ granted: true } as never);
    const { presentInboxNotification } = load();
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();

    await presentInboxNotification(sampleInboxItem, "sbx_1");
    await presentInboxNotification({ ...sampleInboxItem, id: "inb_2" }, "sbx_1");

    expect(mocked.setNotificationHandler).toHaveBeenCalledTimes(1);
    expect(mocked.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mocked.scheduleNotificationAsync.mock.calls[0][0]).toMatchObject({
      identifier: sampleInboxItem.id,
      content: { title: sampleInboxItem.title, body: sampleInboxItem.body, data: { url: "/inbox", sandboxId: "sbx_1", itemId: sampleInboxItem.id, kind: sampleInboxItem.kind } },
    });
  });

  it("does nothing when the user said no and cannot be asked again", async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false } as never);
    const { presentInboxNotification } = load();
    await presentInboxNotification(sampleInboxItem, "sbx_1");
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("delivers the cold-start tap and later taps, then clears them", () => {
    const response = { notification: { request: { content: { data: { url: "/inbox" } } } } };
    mocked.getLastNotificationResponse.mockReturnValue(response as never);
    const { subscribeNotificationTaps } = load();
    const onTap = jest.fn();
    const unsubscribe = subscribeNotificationTaps(onTap);
    const listener = mocked.addNotificationResponseReceivedListener.mock.calls[0][0];
    listener(response as never);
    unsubscribe();
    expect(onTap).toHaveBeenCalledTimes(2);
    expect(onTap).toHaveBeenCalledWith({ url: "/inbox" });
    expect(mocked.clearLastNotificationResponse).toHaveBeenCalledTimes(2);
  });

  it("hides remote pushes in the foreground and for items already shown locally", async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ granted: true } as never);
    const { presentInboxNotification } = load();
    await presentInboxNotification(sampleInboxItem, "sbx_1");
    const { handleNotification } = mocked.setNotificationHandler.mock.calls[0][0]!;
    const notification = (itemId: string, trigger: unknown) =>
      ({ request: { trigger, content: { data: { url: "/inbox", sandboxId: "sbx_1", itemId, kind: "permission", artifactId: null } } } }) as never;
    const setAppState = (value: string) => Object.defineProperty(AppState, "currentState", { value, configurable: true, writable: true });

    setAppState("active");
    expect((await handleNotification(notification("inb_new", { type: "push" }))).shouldShowBanner).toBe(false);
    expect((await handleNotification(notification("inb_new", null))).shouldShowBanner).toBe(true);
    setAppState("background");
    expect((await handleNotification(notification("inb_new", { type: "push" }))).shouldShowBanner).toBe(true);
    expect((await handleNotification(notification(sampleInboxItem.id, { type: "push" }))).shouldShowBanner).toBe(false);
  });
});

describe("expo push token", () => {
  it("creates the channel, asks for permission and fetches the token for the project", async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ granted: true } as never);
    const { getExpoPushToken } = load();
    await expect(getExpoPushToken()).resolves.toBe("ExponentPushToken[abc]");
    expect(mocked.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "proj-1", devicePushToken: { type: "ios", data: "apns" } });
  });

  it("returns nothing without permission or on a simulator", async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false } as never);
    await expect(load().getExpoPushToken()).resolves.toBeNull();
    mocked.getPermissionsAsync.mockResolvedValue({ granted: true } as never);
    mockIsDevice = false;
    await expect(load().getExpoPushToken()).resolves.toBeNull();
    mockIsDevice = true;
    expect(mocked.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it("reports token rotations", () => {
    const { subscribePushTokenChanges } = load();
    const onChange = jest.fn();
    const unsubscribe = subscribePushTokenChanges(onChange);
    mocked.addPushTokenListener.mock.calls[0][0]({ type: "android", data: "fcm" } as never);
    unsubscribe();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("ignores the token event that every fetch echoes back", async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ granted: true } as never);
    const { getExpoPushToken, subscribePushTokenChanges } = load();
    const onChange = jest.fn();
    subscribePushTokenChanges(onChange);
    const listener = mocked.addPushTokenListener.mock.calls[0][0];
    await getExpoPushToken();
    listener({ type: "ios", data: "apns" } as never);
    expect(onChange).not.toHaveBeenCalled();
    listener({ type: "ios", data: "apns-rotated" } as never);
    listener({ type: "ios", data: "apns-rotated" } as never);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
