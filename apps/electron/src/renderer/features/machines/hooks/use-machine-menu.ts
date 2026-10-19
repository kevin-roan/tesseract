import { useMemo } from "react";
import { usePreferencesRoute } from "../../../app/navigation";
import type { MenuSections } from "../../../components/ActionMenu";
import { MACHINE_ICON, MACHINE_LOCAL_ICON } from "../constants";
import { MACHINE_LABELS as L } from "../labels";
import { useMachines } from "./use-machines";

export function useMachineActionSections(): MenuSections {
  const { active, openAdd, openRename } = useMachines();
  const { openPreferences } = usePreferencesRoute();
  return useMemo<MenuSections>(
    () => [
      [
        ...(active ? [{ id: "machine-rename", label: L.rename, icon: "rename" as const, onSelect: () => openRename(active.id) }] : []),
        { id: "machine-add", label: L.add, icon: "add", onSelect: openAdd },
        { id: "machine-manage", label: L.manage, icon: "connection", onSelect: () => openPreferences("connection") },
      ],
    ],
    [active, openAdd, openPreferences, openRename],
  );
}

export function useMachineMenuSections(): MenuSections {
  const { machines, switchTo } = useMachines();
  const actions = useMachineActionSections();
  return useMemo<MenuSections>(
    () => [
      machines.map((machine) => ({
        id: `machine-${machine.id}`,
        label: machine.label,
        icon: machine.local ? MACHINE_LOCAL_ICON : MACHINE_ICON,
        checked: machine.active,
        onSelect: () => switchTo(machine.id),
      })),
      ...actions,
    ],
    [actions, machines, switchTo],
  );
}
