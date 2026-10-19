import { useCallback, useEffect, useMemo, useState } from "react";
import { describeError } from "../../../app/connection";
import { useActionMenu, type MenuSections } from "../../../components/ActionMenu";
import { MACHINE_LABELS, useMachines, type MachineRow } from "../../../features/machines";
import { usePreferencesToast } from "../shared/use-preferences-toast";
import { SECTION_LABELS as L } from "./labels";

export function useMachinesGroup() {
  const machines = useMachines();
  const menu = useActionMenu();
  const toast = usePreferencesToast();
  const [menuId, setMenuId] = useState<string | null>(null);
  const target = machines.find(menuId);
  const { setHostLink, openRename, openHostLink, confirmRemove, switchTo, refreshStatus } = machines;

  useEffect(() => {
    refreshStatus(true);
  }, [refreshStatus]);

  const openMenu = useCallback(
    (id: string, element: HTMLElement) => {
      setMenuId(id);
      menu.openBelow(element);
    },
    [menu],
  );

  const unlink = useCallback(
    (machine: MachineRow) =>
      setHostLink(machine.id, null)
        .then(() => toast(MACHINE_LABELS.unlinked(machine.label)))
        .catch((error: unknown) => toast(describeError(error), true)),
    [setHostLink, toast],
  );

  const sections = useMemo<MenuSections>(() => {
    if (!target) return [];
    return [
      target.active ? [] : [{ id: "switch", label: L.machineSwitch, icon: "shuffle" as const, onSelect: () => switchTo(target.id) }],
      [
        { id: "rename", label: L.machineRename, icon: "rename", onSelect: () => openRename(target.id) },
        ...(target.local
          ? []
          : [
              { id: "host-link", label: target.host ? L.machineReplaceHost : L.machineLinkHost, icon: "link" as const, onSelect: () => openHostLink(target.id) },
              ...(target.host ? [{ id: "host-unlink", label: L.machineUnlinkHost, icon: "close" as const, onSelect: () => void unlink(target) }] : []),
            ]),
      ],
      [{ id: "remove", label: L.machineRemove, icon: "delete", danger: true, disabled: !target.removable, onSelect: () => confirmRemove(target.id) }],
    ];
  }, [confirmRemove, openHostLink, openRename, switchTo, target, unlink]);

  const subtitle = useCallback((machine: MachineRow) => L.machineSubtitle([machine.detail, machine.statusLabel, machine.hostLabel]), []);

  return { ...machines, menu, sections, openMenu, menuTarget: target, subtitle };
}
