import { useCallback } from "react";
import { useActionMenu } from "../../../components/ActionMenu";
import { MACHINE_LABELS as L } from "../labels";
import { useMachineActionSections } from "./use-machine-menu";
import { useMachines } from "./use-machines";

export function useMachineSwitcher() {
  const menu = useActionMenu();
  const machines = useMachines();
  const actions = useMachineActionSections();
  const { refreshStatus, active, connecting } = machines;
  const { openBelow } = menu;

  const toggle = useCallback(
    (target: HTMLElement) => {
      if (menu.open) {
        menu.close();
        return;
      }
      refreshStatus(true);
      openBelow(target);
    },
    [menu, openBelow, refreshStatus],
  );

  const name = active?.label ?? null;
  return {
    menu,
    machines: machines.machines,
    actions,
    switchTo: machines.switchTo,
    toggle,
    name: connecting ? L.connecting : name,
    tooltip: connecting && name ? L.connectingTo(name) : L.switcherTooltip,
  };
}
