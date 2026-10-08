import type { TesseractClient } from "@tesseract/client";
import type { DisplayStatus } from "@tesseract/protocol";
import { useCallback, useMemo, useRef, useState } from "react";
import { describeError, usePoller } from "../../../app/connection";
import { STATUS_POLL_MS } from "../constants";

export interface DisplayStatusHandle {
  status: DisplayStatus | null;
  error: string | null;
  setStatus(status: DisplayStatus | null): void;
  clear(): void;
  checkAgain(): void;
}

export function useDisplayStatus(client: TesseractClient | null, polling: boolean): DisplayStatusHandle {
  const [status, setStatus] = useState<DisplayStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const enabled = polling && client !== null;
  const onResult = useCallback((value: DisplayStatus) => {
    setStatus(value);
    setError(null);
  }, []);
  const onError = useCallback((reason: unknown) => {
    setError(describeError(reason));
    setStatus(null);
  }, []);
  const poller = usePoller((signal) => (client ? client.displayStatus({ signal }) : Promise.reject(new Error())), STATUS_POLL_MS, {
    enabled,
    onResult,
    onError,
  });
  const latest = useRef({ client, enabled, poller });
  latest.current = { client, enabled, poller };

  const checkAgain = useCallback(() => {
    const { client: current, enabled: active, poller: handle } = latest.current;
    setError(null);
    if (active) {
      handle.refresh();
      return;
    }
    current?.displayStatus().then(onResult, onError);
  }, [onError, onResult]);

  const clear = useCallback(() => {
    setStatus(null);
    setError(null);
  }, []);

  return useMemo(() => ({ status, error, setStatus, clear, checkAgain }), [status, error, clear, checkAgain]);
}
