import { useMemo } from "react";
import type { MenuSections } from "../../../components/ActionMenu";
import { MENU_LABELS } from "../labels";
import { inputEnabled } from "../model";
import { terminalSessions } from "../sessions";
import type { LiveSession, TerminalCommand } from "../types";

const entry = (id: string, command: TerminalCommand, label: string, disabled = false) => ({
  id: command,
  label,
  disabled,
  onSelect: () => terminalSessions.get(id)?.run(command),
});

export function useTerminalMenus(id: string | null, live: LiveSession | null) {
  const hasSelection = live?.hasSelection ?? false;
  const canPaste = live ? inputEnabled(live.state) : false;
  return useMemo(() => {
    if (!id) return { toolbar: [] as MenuSections, context: [] as MenuSections };
    const clipboard = [entry(id, "copy", MENU_LABELS.copy, !hasSelection), entry(id, "paste", MENU_LABELS.paste, !canPaste), entry(id, "selectAll", MENU_LABELS.selectAll)];
    const zoom = [entry(id, "zoomIn", MENU_LABELS.zoomIn), entry(id, "zoomOut", MENU_LABELS.zoomOut), entry(id, "zoomReset", MENU_LABELS.zoomReset)];
    const clear = [entry(id, "clear", MENU_LABELS.clear)];
    const toolbarClipboard = [entry(id, "copy", MENU_LABELS.copy), entry(id, "paste", MENU_LABELS.paste), entry(id, "selectAll", MENU_LABELS.selectAll)];
    return { toolbar: [toolbarClipboard, zoom, clear] as MenuSections, context: [clipboard, clear] as MenuSections };
  }, [id, hasSelection, canPaste]);
}
