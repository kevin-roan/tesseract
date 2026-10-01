import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import type { InboxItem } from "@theone/protocol";

import { playHaptic } from "@/lib/haptics";

import { INBOX_NOTIFICATION_CHANNEL, PRESENTED_ITEMS_LIMIT } from "../utils/constants";
import { isRemoteTrigger, notificationData, parseNotificationData, shouldPresent } from "../utils/notify";

let handlerReady = false;
let permission: Promise<boolean> | null = null;
let lastDeviceToken: unknown = null;
const presented = new Set<string>();

function rememberPresented(itemId: string): void {
  presented.delete(itemId);
  presented.add(itemId);
  if (presented.size <= PRESENTED_ITEMS_LIMIT) return;
  const oldest = presented.values().next().value;
  if (oldest !== undefined) presented.delete(oldest);
}

export function prepareNotifications(): void {
  if (handlerReady) return;
  handlerReady = true;
  Notifications.setNotificationHandler({
    handleNotification: async ({ request }) => {
      const show = shouldPresent({
        remote: isRemoteTrigger(request.trigger),
        appState: AppState.currentState,
        itemId: parseNotificationData(request.content.data)?.itemId ?? null,
        presented,
      });
      if (show && AppState.currentState === "active") playHaptic("notify");
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
    },
  });
}

async function requestPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return next.granted;
}

function ensurePermission(): Promise<boolean> {
  permission ??= requestPermission().catch(() => false);
  return permission;
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(INBOX_NOTIFICATION_CHANNEL, {
    name: "Claude needs you",
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export async function presentInboxNotification(item: InboxItem, sandboxId: string): Promise<void> {
  prepareNotifications();
  if (!(await ensurePermission())) return;
  await ensureChannel();
  rememberPresented(item.id);
  await Notifications.scheduleNotificationAsync({
    identifier: item.id,
    content: { title: item.title, body: item.body, data: notificationData(item, sandboxId) },
    trigger: Platform.OS === "android" ? { channelId: INBOX_NOTIFICATION_CHANNEL } : null,
  });
}

export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const projectId: unknown = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (typeof projectId !== "string" || !projectId) throw new Error("Missing EAS projectId for push notifications");
  prepareNotifications();
  await ensureChannel();
  if (!(await ensurePermission())) return null;
  const devicePushToken = await Notifications.getDevicePushTokenAsync();
  lastDeviceToken = devicePushToken.data;
  const token = await Notifications.getExpoPushTokenAsync({ projectId, devicePushToken });
  return token.data;
}

// iOS emits the push token event on every fetch, not only on rotation, so an
// unchanged token must not trigger another fetch or it loops forever.
export function subscribePushTokenChanges(onChange: () => void): () => void {
  const subscription = Notifications.addPushTokenListener(({ data }) => {
    if (data === lastDeviceToken) return;
    lastDeviceToken = data;
    onChange();
  });
  return () => subscription.remove();
}

export function subscribeNotificationTaps(onTap: (data: unknown) => void): () => void {
  const last = Notifications.getLastNotificationResponse();
  if (last) {
    onTap(last.notification.request.content.data);
    Notifications.clearLastNotificationResponse();
  }
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    onTap(response.notification.request.content.data);
    Notifications.clearLastNotificationResponse();
  });
  return () => subscription.remove();
}
