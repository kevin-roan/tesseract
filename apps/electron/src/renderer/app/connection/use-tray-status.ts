import { useEffect } from "react";
import { ipc } from "../../lib/ipc";
import { useConnectionState } from "./hooks";
import { CONNECTION_STATUS_LABELS } from "./labels";
import type { ConnectionState } from "./types";

const selectStatus = (state: ConnectionState) => state.status;

export function useTrayStatus(): void {
  const status = useConnectionState(selectStatus);
  useEffect(() => {
    void ipc.tray.setStatus(CONNECTION_STATUS_LABELS[status]).catch(() => undefined);
  }, [status]);
}
