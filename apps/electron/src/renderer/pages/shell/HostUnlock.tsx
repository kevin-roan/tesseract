import { HostUnlockDialog } from "../../components/HostUnlockDialog";
import type { HostGateState } from "../../features/host-shell/hooks/use-host-gate";

export interface HostUnlockProps {
  dialog: HostGateState["unlockDialog"];
}

export function HostUnlock({ dialog }: HostUnlockProps) {
  return <HostUnlockDialog open={dialog.open} onUnlock={dialog.unlock} onClose={dialog.close} />;
}
