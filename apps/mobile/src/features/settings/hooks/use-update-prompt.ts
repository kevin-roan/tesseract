import { useCallback, useState } from "react";
import { usePathname } from "expo-router";

import { formatTimestamp, showsUpdatePrompt } from "../utils/about";
import { UPDATE_SHEET_COPY } from "../utils/constants";
import { useAppUpdates } from "./use-app-updates";

export function useUpdatePrompt() {
  const pathname = usePathname();
  const updates = useAppUpdates();
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const updateId = updates.nextUpdate?.id ?? null;

  const dismiss = useCallback(() => setDismissedId(updateId), [updateId]);

  return {
    visible: updates.available && updateId !== dismissedId && showsUpdatePrompt(pathname),
    title: UPDATE_SHEET_COPY.title,
    message: UPDATE_SHEET_COPY.message,
    detail: updates.nextUpdate ? UPDATE_SHEET_COPY.published(formatTimestamp(updates.nextUpdate.createdAt)) : null,
    installLabel: UPDATE_SHEET_COPY.install,
    laterLabel: UPDATE_SHEET_COPY.later,
    installing: updates.installing,
    error: updates.installError,
    errorTitle: UPDATE_SHEET_COPY.failed,
    install: updates.install,
    dismiss,
  };
}
