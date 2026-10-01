import { Platform } from "react-native";
import * as Device from "expo-device";
import { PushPlatformSchema } from "@theone/protocol";

import { getSandboxClient } from "@/features/sandbox/api/client";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";
import type { PairedSandbox } from "@/features/sandbox/types";

import { pushDeviceName } from "../utils/notify";

let currentToken: string | null = null;
const registered = new Map<string, string>();
const remoteIds = new Map<string, Promise<string | null>>();

export function reportPushError(error: unknown): void {
  if (__DEV__) console.warn("[push]", error);
}

const registrationKey = (sandbox: PairedSandbox, auth: string, pushToken: string): string =>
  [sandbox.baseUrl, auth, pushToken].join("\n");

function remoteSandboxId(sandbox: PairedSandbox, auth: string): Promise<string | null> {
  let pending = remoteIds.get(sandbox.id);
  if (!pending) {
    pending = getSandboxClient(sandbox, auth)
      .health()
      .then(
        (health) => health.sandboxId,
        () => {
          remoteIds.delete(sandbox.id);
          return null;
        },
      );
    remoteIds.set(sandbox.id, pending);
  }
  return pending;
}

export async function registerPushToken(
  pushToken: string,
  sandboxes: readonly PairedSandbox[],
  tokens: Readonly<Record<string, string>>,
): Promise<void> {
  currentToken = pushToken;
  const platform = PushPlatformSchema.safeParse(Platform.OS);
  if (!platform.success) return;
  const name = pushDeviceName(Device.deviceName);
  await Promise.all(
    sandboxes.map(async (sandbox) => {
      const auth = tokens[sandbox.id];
      if (!auth) return;
      const key = registrationKey(sandbox, auth, pushToken);
      if (registered.get(sandbox.id) === key) return;
      registered.set(sandbox.id, key);
      try {
        await getSandboxClient(sandbox, auth).registerPushDevice({ token: pushToken, platform: platform.data, name });
        void remoteSandboxId(sandbox, auth);
      } catch (error) {
        if (registered.get(sandbox.id) === key) registered.delete(sandbox.id);
        reportPushError(error);
      }
    }),
  );
}

export function unregisterPushToken(sandboxId: string): void {
  registered.delete(sandboxId);
  remoteIds.delete(sandboxId);
  const { sandboxes, tokens } = useSandboxStore.getState();
  const sandbox = sandboxes.find((entry) => entry.id === sandboxId);
  const auth = tokens[sandboxId];
  if (!currentToken || !sandbox || !auth) return;
  getSandboxClient(sandbox, auth).unregisterPushDevice(currentToken).catch(reportPushError);
}

export async function findPushSandbox(sandboxId: string): Promise<string | null> {
  const { sandboxes, tokens } = useSandboxStore.getState();
  if (sandboxes.some((sandbox) => sandbox.id === sandboxId)) return sandboxId;
  const matches = await Promise.all(
    sandboxes.map(async (sandbox) => {
      const auth = tokens[sandbox.id];
      return auth && (await remoteSandboxId(sandbox, auth)) === sandboxId ? sandbox.id : null;
    }),
  );
  return matches.find((id) => id !== null) ?? null;
}
