import { usePreferencesRoute } from "../../../app/navigation";
import { PairDialog, type PairTarget } from "../../../components/PairDialog";
import { useMasterHost } from "../../../features/master-host/hooks/use-master-host";
import { useHostShell } from "../host-shell/use-host-shell";
import { useSandboxPairing } from "../host-shell/use-sandbox-pairing";

export interface PairPhoneDialogProps {
  open: boolean;
  target: PairTarget;
  onClose(): void;
}

export function PairPhoneDialog({ open, target, onClose }: PairPhoneDialogProps) {
  const host = useHostShell();
  const master = useMasterHost();
  const sandbox = useSandboxPairing();
  const { openPreferences } = usePreferencesRoute();
  return (
    <PairDialog
      open={open}
      initialTarget={target}
      sandbox={sandbox}
      host={host.state}
      master={master.state}
      onClose={onClose}
      onOpenPreferences={() => {
        onClose();
        openPreferences(target === "host" ? "host-shell" : "connection");
      }}
      onStartHost={() => host.setServe(true)}
      onRefreshHost={host.refresh}
      onLinkMaster={master.link}
      onUnlinkMaster={master.unlink}
      onRefreshMaster={master.refresh}
      onSavePin={host.savePin}
    />
  );
}
