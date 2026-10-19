import { useCallback, useState } from "react";
import { errorMessage } from "../../../components/FormDialog";
import { useMasterHost } from "../../../features/master-host/hooks/use-master-host";
import { usePreferencesToast } from "../shared/use-preferences-toast";
import { SECTION_LABELS } from "./labels";
import { masterHostRow, type MasterHostRow } from "./model";

export interface MasterHostRowState {
  row: MasterHostRow | null;
  busy: boolean;
  unlink(): void;
}

export function useMasterHostRow(): MasterHostRowState {
  const master = useMasterHost();
  const toast = usePreferencesToast();
  const [busy, setBusy] = useState(false);
  const { unlink: unlinkMaster } = master;

  const unlink = useCallback(() => {
    setBusy(true);
    unlinkMaster()
      .then(() => toast(SECTION_LABELS.masterUnlinkDone))
      .catch((error: unknown) => toast(SECTION_LABELS.masterUnlinkFailed(errorMessage(error)), true))
      .finally(() => setBusy(false));
  }, [toast, unlinkMaster]);

  return { row: masterHostRow(master.state), busy, unlink };
}
