import * as Device from "expo-device";
import type { AccountSession } from "@tesseract/protocol";

import { connectTailnet, disconnectTailnet } from "@/features/tailnet";

import { accountApi, type AccountApi } from "../api/client";
import { useAccountStore } from "../store/account-store";
import { MOBILE_DEVICE_KIND } from "../utils/content";
import { deviceHostname } from "../utils/hostname";

export async function connectDevice(token: string, api: AccountApi = accountApi()): Promise<void> {
  const key = await api.createDeviceKey(token, { kind: MOBILE_DEVICE_KIND, hostname: deviceHostname(Device.deviceName) });
  await connectTailnet(key);
}

export type StartResult = { session: AccountSession; connectError: unknown };

/** Keeps the session even when joining the network fails, so the account screen can offer a reconnect. */
export async function startSession(session: AccountSession, api: AccountApi = accountApi()): Promise<StartResult> {
  await useAccountStore.getState().setSession(session);
  try {
    await connectDevice(session.token, api);
    return { session, connectError: null };
  } catch (error) {
    return { session, connectError: error };
  }
}

export async function endSession(): Promise<void> {
  await disconnectTailnet({ logout: true }).catch(() => undefined);
  await useAccountStore.getState().clear();
}

export async function signOut(api: AccountApi = accountApi()): Promise<void> {
  const token = useAccountStore.getState().session?.token;
  if (token) await api.signOut(token).catch(() => undefined);
  await endSession();
}

export async function deleteAccount(api: AccountApi = accountApi()): Promise<void> {
  const token = useAccountStore.getState().session?.token;
  if (token) await api.deleteAccount(token);
  await endSession();
}
