import type { TesseractClient } from "@tesseract/client";
import { useCallback, useMemo } from "react";
import { describeError } from "../../../app/connection";
import { showToast } from "../../../components/Toast";
import { ipc } from "../../../lib/ipc";
import { bytesToBase64 } from "../../../lib/base64";
import { TOAST_LABELS } from "../labels";
import { screenshotFileName } from "../model";

export interface DisplayActions {
  saveScreenshot(): Promise<void>;
  openInBrowser(): Promise<void>;
}

export function useDisplayActions(client: TesseractClient | null): DisplayActions {
  const saveScreenshot = useCallback(async () => {
    if (!client) return;
    try {
      const bytes = await client.screenshot();
      const saved = await ipc.files.saveBytes(screenshotFileName(new Date()), bytesToBase64(new Uint8Array(bytes)));
      if (saved) showToast(TOAST_LABELS.screenshotSaved(saved.name));
    } catch (error) {
      showToast(TOAST_LABELS.screenshotFailed(describeError(error)));
    }
  }, [client]);

  const openInBrowser = useCallback(async () => {
    if (!client) return;
    try {
      await ipc.app.openExternal(await client.vncPageUrl());
    } catch (error) {
      showToast(TOAST_LABELS.browserFailed(describeError(error)));
    }
  }, [client]);

  return useMemo(() => ({ saveScreenshot, openInBrowser }), [saveScreenshot, openInBrowser]);
}
