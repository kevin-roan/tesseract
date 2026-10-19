import { useHostGate } from "../../host-shell/hooks/use-host-gate";
import { useTerminalsWorkspace } from "../../terminals/hooks/use-terminals-workspace";
import { gateEmpty, hostRowModel, hostSessionTitle } from "../model";

const OPTIONS = { titleOf: hostSessionTitle, rowOf: hostRowModel };

export function useHostShellPage() {
  const host = useHostGate();
  const workspace = useTerminalsWorkspace(OPTIONS);
  return { host, workspace, empty: gateEmpty(host.gate) };
}
