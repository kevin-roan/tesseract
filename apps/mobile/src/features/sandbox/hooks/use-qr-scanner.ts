import { useCallback, useRef } from "react";
import { useCameraPermissions, type BarcodeScanningResult } from "expo-camera";

export type ScannerPermission = "unknown" | "granted" | "prompt" | "blocked";

export function useQrScanner(onCode: (data: string) => Promise<unknown> | unknown, paused: boolean) {
  const [permission, requestPermission] = useCameraPermissions();
  const lastCode = useRef<string | null>(null);
  const busy = useRef(false);

  const onBarcodeScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (paused || busy.current || data === lastCode.current) return;
      busy.current = true;
      lastCode.current = data;
      try {
        await onCode(data);
      } finally {
        busy.current = false;
      }
    },
    [onCode, paused],
  );

  const rescan = useCallback(() => {
    lastCode.current = null;
  }, []);

  const state: ScannerPermission = !permission
    ? "unknown"
    : permission.granted
      ? "granted"
      : permission.canAskAgain
        ? "prompt"
        : "blocked";

  return { permission: state, requestPermission, onBarcodeScanned, rescan };
}
