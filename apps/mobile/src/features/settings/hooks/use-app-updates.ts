import { useCallback, useState } from "react";
import * as Updates from "expo-updates";

import { captureException } from "@/lib/monitoring";

import type { UpdateStatus } from "../utils/about";

export function useAppUpdates() {
  const updates = Updates.useUpdates();
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  const check = useCallback(async () => {
    const result = await Updates.checkForUpdateAsync().catch(() => null);
    if (result?.isAvailable) await Updates.fetchUpdateAsync().catch(() => undefined);
  }, []);

  const restart = useCallback(() => {
    Updates.reloadAsync().catch(captureException);
  }, []);

  const install = useCallback(async () => {
    setInstalling(true);
    setInstallError(null);
    try {
      if (!updates.isUpdatePending) {
        const result = await Updates.fetchUpdateAsync();
        if (!result.isNew && !result.isRollBackToEmbedded) return;
      }
      await Updates.reloadAsync();
    } catch (error) {
      captureException(error);
      setInstallError(error instanceof Error ? error.message : String(error));
    } finally {
      setInstalling(false);
    }
  }, [updates.isUpdatePending]);

  const status: UpdateStatus = {
    enabled: Updates.isEnabled,
    checking: updates.isChecking,
    downloading: updates.isDownloading,
    pending: updates.isUpdatePending,
    checkedAt: updates.lastCheckForUpdateTimeSinceRestart ?? null,
    checkError: updates.checkError?.message ?? null,
    downloadError: updates.downloadError?.message ?? null,
  };

  const nextUpdate = updates.downloadedUpdate ?? updates.availableUpdate;

  return {
    status,
    available: Updates.isEnabled && (updates.isUpdateAvailable || updates.isUpdatePending),
    nextUpdate: nextUpdate ? { id: nextUpdate.updateId ?? "rollback", createdAt: nextUpdate.createdAt } : null,
    emergencyReason: updates.currentlyRunning.isEmergencyLaunch ? updates.currentlyRunning.emergencyLaunchReason : null,
    installing,
    installError,
    check,
    restart,
    install,
  };
}
