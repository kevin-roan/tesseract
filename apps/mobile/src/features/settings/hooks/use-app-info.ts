import { useMemo } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";

import type { AboutInfo } from "../utils/about";

function nativeBuild(): string | null {
  if (Platform.OS === "ios") return Constants.platform?.ios?.buildNumber ?? null;
  const code = Constants.platform?.android?.versionCode;
  return code ? String(code) : null;
}

export function useAppInfo(): AboutInfo {
  const { currentlyRunning } = Updates.useUpdates();

  return useMemo(
    () => ({
      version: Constants.expoConfig?.version ?? null,
      build: nativeBuild(),
      channel: currentlyRunning.channel ?? Updates.channel,
      runtimeVersion: currentlyRunning.runtimeVersion ?? Updates.runtimeVersion,
      updateId: currentlyRunning.updateId ?? null,
      createdAt: currentlyRunning.createdAt ?? null,
      isEmbeddedLaunch: currentlyRunning.isEmbeddedLaunch,
      platform: `${Platform.OS} ${Platform.Version}`,
      isDev: __DEV__,
    }),
    [currentlyRunning],
  );
}
