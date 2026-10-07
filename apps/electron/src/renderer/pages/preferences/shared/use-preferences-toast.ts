import { useCallback } from "react";
import { showToast } from "../../../components/Toast";
import { PREFERENCES_TOAST_MS, PREFERENCES_TOAST_SCOPE } from "../constants";

export function usePreferencesToast() {
  return useCallback((message: string, failure = false) => {
    showToast(message, {
      scope: PREFERENCES_TOAST_SCOPE,
      timeoutMs: failure ? PREFERENCES_TOAST_MS.failure : PREFERENCES_TOAST_MS.default,
    });
  }, []);
}
