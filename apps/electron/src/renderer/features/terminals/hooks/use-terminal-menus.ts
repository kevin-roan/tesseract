import { useMemo } from "react";
import type { MenuSections } from "../../../components/ActionMenu";
import { MENU_LABELS } from "../labels";
import { inputEnabled } from "../model";
import { useTerminalsScope } from "../scope";
import type { TerminalSessions } from "../sessions";
import type { LiveSession, TerminalCommand } from "../types";

const entry = (sessions: TerminalSessions, id: string, command: TerminalCommand, label: string, disabled = false) => ({
  id: command,
  label,
  disabled,
  onSelect: () => sessions.get(id)?.run(command),
});

export function useTerminalMenus(id: string | null, live: LiveSession | null) {
  const { sessions } = useTerminalsScope();
  const hasSelection = live?.hasSelection ?? false;
  const canPaste = live ? inputEnabled(live.state) : false;
  return useMemo(() => {
    if (!id) return { toolbar: [] as MenuSections, context: [] as MenuSections };
    const clipboard = [entry(sessions, id, "copy", MENU_LABELS.copy, !hasSelection), entry(sessions, id, "paste", MENU_LABELS.paste, !canPaste), entry(sessions, id, "selectAll", MENU_LABELS.selectAll)];
    const zoom = [entry(sessions, id, "zoomIn", MENU_LABELS.zoomIn), entry(sessions, id, "zoomOut", MENU_LABELS.zoomOut), entry(sessions, id, "zoomReset", MENU_LABELS.zoomReset)];
    const clear = [entry(sessions, id, "clear", MENU_LABELS.clear)];
    const toolbarClipboard = [entry(sessions, id, "copy", MENU_LABELS.copy), entry(sessions, id, "paste", MENU_LABELS.paste), entry(sessions, id, "selectAll", MENU_LABELS.selectAll)];
    return { toolbar: [toolbarClipboard, zoom, clear] as MenuSections, context: [clipboard, clear] as MenuSections };
  }, [sessions, id, hasSelection, canPaste]);
}
