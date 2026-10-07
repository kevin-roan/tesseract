import { usePreferencesRoute } from "../app/navigation";
import { PairDialog } from "../components/PairDialog";
import { useHostShell } from "../pages/preferences/host-shell/use-host-shell";
import { useSandboxPairing } from "../pages/preferences/host-shell/use-sandbox-pairing";
import { AboutDialog } from "./AboutDialog";
import { useShellDialogs } from "./hooks/use-shell-dialogs";

function ShellPairDialog({ host }: { host: boolean }) {
  const close = useShellDialogs((store) => store.close);
  const hostShell = useHostShell();
  const sandbox = useSandboxPairing();
  const { openPreferences } = usePreferencesRoute();
  return (
    <PairDialog
      initialTarget={host ? "host" : "sandbox"}
      sandbox={sandbox}
      host={hostShell.state}
      onClose={close}
      onOpenPreferences={() => {
        close();
        openPreferences(host ? "host-shell" : "connection");
      }}
      onStartHost={() => hostShell.setServe(true)}
      onRefreshHost={hostShell.refresh}
      onSavePin={hostShell.savePin}
    />
  );
}

export function ShellDialogs() {
  const dialog = useShellDialogs((store) => store.dialog);
  const close = useShellDialogs((store) => store.close);
  return (
    <>
      {dialog === "pair" || dialog === "pair-host" ? <ShellPairDialog host={dialog === "pair-host"} /> : null}
      <AboutDialog open={dialog === "about"} onClose={close} />
    </>
  );
}
