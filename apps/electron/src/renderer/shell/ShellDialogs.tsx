import { PairPhoneDialog } from "../pages/preferences/shared/PairPhoneDialog";
import { AboutDialog } from "./AboutDialog";
import { useShellDialogs } from "./hooks/use-shell-dialogs";

export function ShellDialogs() {
  const dialog = useShellDialogs((store) => store.dialog);
  const close = useShellDialogs((store) => store.close);
  return (
    <>
      {dialog === "pair" || dialog === "pair-host" ? <PairPhoneDialog open target={dialog === "pair-host" ? "host" : "sandbox"} onClose={close} /> : null}
      <AboutDialog open={dialog === "about"} onClose={close} />
    </>
  );
}
