import { useCallback } from "react";
import { errorMessage } from "../../../components/FormDialog";
import { showToast } from "../../../components/Toast";
import { ipc } from "../../../lib/ipc";

export function useOpenExternal() {
  return useCallback((url: string) => {
    ipc.app.openExternal(url).catch((error: unknown) => showToast(errorMessage(error)));
  }, []);
}
