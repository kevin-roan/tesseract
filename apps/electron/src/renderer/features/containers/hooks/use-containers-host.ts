import { useHostGate } from "../../host-shell/hooks/use-host-gate";
import { useContainersMachine } from "./use-containers-machine";

/** Containers live on the active machine: on a Tesseract server the page needs an unlocked host session first. */
export function useContainersHost() {
  const { remote } = useContainersMachine();
  const host = useHostGate();
  return {
    gate: remote ? host.gate : null,
    onAction: host.onAction,
    onSecondary: host.onSecondary,
    unlockDialog: host.unlockDialog,
  };
}
