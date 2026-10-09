import { usePreferencesRoute } from "../../../app/navigation";
import { PairDialog, type PairTarget } from "../../../components/PairDialog";
import { useHostShell } from "../host-shell/use-host-shell";
import { useSandboxPairing } from "../host-shell/use-sandbox-pairing";

export interface PairPhoneDialogProps {
  open: boolean;
  target: PairTarget;
  onClose(): void;
}

export function PairPhoneDialog({ open, target, onClose }: PairPhoneDialogProps) {
  const host = useHostShell();
  const sandbox = useSandboxPairing();
  const { openPreferences } = usePreferencesRoute();
  return (
    <PairDialog
      open={open}
      initialTarget={target}
      sandbox={sandbox}
      host={host.state}
      onClose={onClose}
      onOpenPreferences={() => {
        onClose();
        openPreferences(target === "host" ? "host-shell" : "connection");
      }}
      onStartHost={() => host.setServe(true)}
      onRefreshHost={host.refresh}
      onSavePin={host.savePin}
    />
  );
}
