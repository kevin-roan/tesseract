import { dialogMachineId, useMachineDialogs } from "../../features/machines";
import { AddMachineDialog } from "./AddMachineDialog";
import { HostLinkDialog } from "./HostLinkDialog";
import { RemoveMachineDialog } from "./RemoveMachineDialog";
import { RenameMachineDialog } from "./RenameMachineDialog";

export function MachineDialogs() {
  const dialog = useMachineDialogs((store) => store.dialog);
  const close = useMachineDialogs((store) => store.close);
  return (
    <>
      <RenameMachineDialog id={dialogMachineId(dialog, "rename")} onClose={close} />
      <HostLinkDialog id={dialogMachineId(dialog, "host-link")} onClose={close} />
      <RemoveMachineDialog id={dialogMachineId(dialog, "remove")} onClose={close} />
      <AddMachineDialog open={dialog?.kind === "add"} onClose={close} />
    </>
  );
}
