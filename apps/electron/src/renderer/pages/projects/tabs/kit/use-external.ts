import { useCallback } from "react";
import { copyText } from "../../../../components/CopyButton";
import { ipc } from "../../../../lib/ipc";

export function useOpenExternal(onError: (error: unknown) => void) {
  return useCallback(
    (url: string) => {
      ipc.app.openExternal(url).catch(onError);
    },
    [onError],
  );
}

export function useCopyText() {
  return useCallback((text: string) => copyText(text), []);
}
