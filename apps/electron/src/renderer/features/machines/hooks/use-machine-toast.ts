import { useCallback } from "react";
import { usePreferencesRoute } from "../../../app/navigation";
import { showToast } from "../../../components/Toast";
import { PREFERENCES_TOAST_SCOPE } from "../../../pages/preferences/constants";

export function useMachineToast() {
  const { open } = usePreferencesRoute();
  return useCallback((message: string) => showToast(message, open ? { scope: PREFERENCES_TOAST_SCOPE } : {}), [open]);
}
