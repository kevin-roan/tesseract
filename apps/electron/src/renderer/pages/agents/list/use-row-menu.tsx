import type { AgentRun } from "@theone/protocol";
import { useMemo } from "react";
import { ActionMenu, useActionMenu, useContextMenu, type MenuSections } from "../../../components/ActionMenu";
import { useRunActions } from "../../../features/agents/hooks/use-run-actions";
import { MANAGE_LABELS } from "../../../features/agents/labels";
import { rowActions } from "../../../features/agents/model";

export function useRowMenu(run: AgentRun, archivedView: boolean) {
  const menu = useActionMenu();
  const actions = useRunActions();
  const available = rowActions(run.state, archivedView);
  const handlers = useContextMenu(menu.openAt, { disabled: available.length === 0 });
  const sections = useMemo<MenuSections>(() => {
    if (available.length === 0) return [];
    const toggle = archivedView
      ? { id: "unarchive", label: MANAGE_LABELS.unarchive, onSelect: () => void actions.setArchived([run.id], false) }
      : { id: "archive", label: MANAGE_LABELS.archive, onSelect: () => void actions.setArchived([run.id], true) };
    return [[toggle], [{ id: "delete", label: MANAGE_LABELS.delete, danger: true, onSelect: () => actions.requestDelete([run.id]) }]];
  }, [available.length, archivedView, actions, run.id]);
  const element = menu.open ? <ActionMenu anchor={menu.anchor} sections={sections} onClose={menu.close} /> : null;
  return { handlers, element };
}
