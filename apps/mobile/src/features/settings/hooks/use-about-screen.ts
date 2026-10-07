import { useMemo } from "react";
import { useWindowDimensions } from "react-native";

import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";

import { appRows, updateRows, updateStatusText } from "../utils/about";
import { useAppInfo } from "./use-app-info";
import { useAppUpdates } from "./use-app-updates";

export function useAboutScreen() {
  const nav = useSandboxNavigation();
  const info = useAppInfo();
  const updates = useAppUpdates();
  const { status } = updates;
  const { width } = useWindowDimensions();

  const rows = useMemo(() => ({ app: appRows(info), updates: updateRows(info) }), [info]);

  return {
    back: nav.back,
    heroSize: Math.min(width * 0.72, 300),
    appRows: rows.app,
    updateRows: rows.updates,
    updates: {
      enabled: status.enabled,
      statusText: updateStatusText(status),
      busy: status.checking || status.downloading,
      pending: status.pending,
      checkError: status.checkError,
      downloadError: status.downloadError,
      emergencyReason: updates.emergencyReason,
      check: updates.check,
      restart: updates.restart,
    },
  };
}
