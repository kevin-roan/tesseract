import { useEffect, useRef } from "react";
import { showToast } from "../../components/Toast";
import { sandboxName, useConnection } from "../connection";
import { CONNECTION_LOST_STATUSES } from "./constants";
import { FEEDBACK_LABELS } from "./labels";

export function useConnectionRecoveryToast(): void {
  const state = useConnection();
  const lost = useRef(false);
  const name = sandboxName(state);
  useEffect(() => {
    if (CONNECTION_LOST_STATUSES.includes(state.status)) {
      lost.current = true;
      return;
    }
    if (state.status !== "online" || !lost.current) return;
    lost.current = false;
    showToast(name ? FEEDBACK_LABELS.connected(name) : FEEDBACK_LABELS.connectedFallback);
  }, [name, state.status]);
}
