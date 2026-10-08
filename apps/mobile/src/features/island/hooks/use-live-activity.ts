import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import { useSandboxClient } from "@/features/sandbox/hooks/use-sandbox-client";

import {
  addPushTokenListener,
  currentActivityId,
  endActivity,
  isIslandAvailable,
  startActivity,
  updateActivity,
  type IslandPushToken,
  type IslandState,
} from "@/modules/tesseract-island";

import { ACTIVITY_END_GRACE_MS, ACTIVITY_UPDATE_THROTTLE_MS } from "../utils/constants";
import { hasLiveWork, stateSignature } from "../utils/state";

const ANDROID_NOTIFICATION_PERMISSION_API = 33;

async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== "android" || Number(Platform.Version) < ANDROID_NOTIFICATION_PERMISSION_API) return true;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

function reportIslandError(error: unknown): void {
  if (__DEV__) console.warn("[island]", error);
}

/** Mirrors the derived island state into the Live Activity (iOS) or ongoing notification (Android). */
export function useLiveActivity(state: IslandState, enabled = true): void {
  const { client } = useSandboxClient();
  const signature = stateSignature(state);
  const live = enabled && hasLiveWork(state);
  const stateRef = useRef(state);
  const lastSentRef = useRef<string | null>(null);
  const lastSentAtRef = useRef(0);
  const updateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const permissionRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!isIslandAvailable()) return;
    const clearTimers = () => {
      if (updateTimer.current) clearTimeout(updateTimer.current);
      if (endTimer.current) clearTimeout(endTimer.current);
      updateTimer.current = null;
      endTimer.current = null;
    };

    const send = () => {
      updateTimer.current = null;
      const next = stateRef.current;
      const nextSignature = stateSignature(next);
      if (nextSignature === lastSentRef.current) return;
      lastSentRef.current = nextSignature;
      lastSentAtRef.current = Date.now();
      const active = currentActivityId() !== null;
      const promise = active
        ? updateActivity(next)
        : (permissionRef.current ??= ensureNotificationPermission()).then((granted) => (granted ? startActivity(next) : null));
      promise.catch(reportIslandError);
    };

    if (live) {
      if (endTimer.current) {
        clearTimeout(endTimer.current);
        endTimer.current = null;
      }
      if (updateTimer.current) return;
      const wait = Math.max(0, lastSentAtRef.current + ACTIVITY_UPDATE_THROTTLE_MS - Date.now());
      updateTimer.current = setTimeout(send, wait);
      return;
    }

    if (currentActivityId() === null) return;
    if (!enabled) {
      clearTimers();
      lastSentRef.current = null;
      endActivity().catch(reportIslandError);
      return;
    }
    if (updateTimer.current) {
      clearTimeout(updateTimer.current);
      updateTimer.current = null;
    }
    if (endTimer.current) return;
    updateActivity(stateRef.current).catch(reportIslandError);
    endTimer.current = setTimeout(() => {
      endTimer.current = null;
      lastSentRef.current = null;
      endActivity().catch(reportIslandError);
    }, ACTIVITY_END_GRACE_MS);

    return () => {
      if (!live) return;
      clearTimers();
    };
  }, [signature, live, enabled]);

  useEffect(() => {
    if (!client || !isIslandAvailable()) return;
    const subscription = addPushTokenListener(({ kind, token, activityId }: IslandPushToken) => {
      client.registerLiveActivity({ kind, token, activityId }).catch(reportIslandError);
    });
    return () => subscription.remove();
  }, [client]);
}
